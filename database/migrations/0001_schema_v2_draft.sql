-- migrate:up
-- LMS-NG schema v2 draft. No v1 baseline exists to diff against (see
-- docs/preflight/CONTRACT_BASELINE_DIFF.md preamble and
-- docs/preflight/BASELINE_INVENTORY.md section 2) -- drafted from Backend Plan v1.3
-- section 6 and revised plan section A.9 prose. Status DRAFT, not applied against any
-- real database in this round (this machine has no Postgres instance -- see
-- docs/preflight/MACHINE_CAPABILITIES.md section 5). Statically checked with sqlglot only.

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS telemetry;
CREATE SCHEMA IF NOT EXISTS alarm;
CREATE SCHEMA IF NOT EXISTS command;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- core ----

CREATE TABLE core.organization (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text UNIQUE NOT NULL,
    name        text NOT NULL,
    timezone    text NOT NULL DEFAULT 'Asia/Bangkok'
);

CREATE TABLE core.site (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES core.organization(id),
    code            text NOT NULL,           -- e.g. 'whz', 'test'
    name            text NOT NULL,
    timezone        text NOT NULL DEFAULT 'Asia/Bangkok',
    topic_root      text NOT NULL,           -- e.g. 'lms/v2/{orgId}/{siteId}', kept here for audit
    UNIQUE (organization_id, code)
);

CREATE TABLE core.building (
    id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id  uuid NOT NULL REFERENCES core.site(id),
    code     text NOT NULL,                  -- e.g. 'WHZ'
    name     text NOT NULL,
    UNIQUE (site_id, code)
);

CREATE TABLE core.floor_profile (
    id    text PRIMARY KEY,                  -- e.g. 'WHZ-PAX', 'WHZ-SERVICE'
    name  text NOT NULL,
    notes text
);

-- Immutable, versioned floor mapping. A correction is a NEW version row, never an UPDATE
-- of an existing (profile_id, version, code) triple -- revised plan section A.7:
-- "core.floor_profile_version/floor_mapping: immutable version/evidence/effective interval;
--  ห้าม UPDATE ทับประวัติ".
CREATE TABLE core.floor_profile_version (
    profile_id     text NOT NULL REFERENCES core.floor_profile(id),
    version        integer NOT NULL,
    effective_from timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, version)
);

CREATE TABLE core.floor_mapping (
    profile_id  text NOT NULL,
    version     integer NOT NULL,
    code        smallint NOT NULL CHECK (code BETWEEN 0 AND 63),
    label       text,                        -- NULL for TRANSIT/UNCALIBRATED
    is_landing  boolean NOT NULL DEFAULT true,
    calibrated  boolean NOT NULL DEFAULT false,
    evidence_type text NOT NULL DEFAULT 'INFERRED'
                  CHECK (evidence_type IN ('OPERATOR_CONFIRMED', 'OBSERVED', 'INFERRED')),
    PRIMARY KEY (profile_id, version, code),
    FOREIGN KEY (profile_id, version) REFERENCES core.floor_profile_version(profile_id, version),
    CHECK (NOT (is_landing AND calibrated) OR label IS NOT NULL)
);

CREATE TABLE core.signal_config_version (
    id          text PRIMARY KEY,            -- e.g. 'whz-pax-1'
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.elevator (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id             uuid NOT NULL REFERENCES core.building(id),
    code                    text NOT NULL,             -- e.g. 'W-02'
    display_name            text NOT NULL,
    lift_id                 smallint NOT NULL CHECK (lift_id BETWEEN 1 AND 99),
    tags                    text[] NOT NULL DEFAULT '{}',
    commissioning_status    text NOT NULL DEFAULT 'NOT_COMMISSIONED'
        CHECK (commissioning_status IN ('COMMISSIONED', 'NOT_COMMISSIONED', 'DISCOVERED_NOT_COMMISSIONED')),
    service_status          text NOT NULL DEFAULT 'UNKNOWN'
        CHECK (service_status IN ('IN_SERVICE', 'OUT_OF_SERVICE', 'UNKNOWN')),
    -- R12: commissioning and service status are DELIBERATELY separate columns, never
    -- collapsed into one "enabled" boolean the way the pre-revision seed data did.
    monitoring_enabled      boolean NOT NULL DEFAULT false,
    floor_profile_id        text NOT NULL REFERENCES core.floor_profile(id),
    gateway_type            text NOT NULL CHECK (gateway_type IN ('REAL', 'SIM')),
    stale_after_sec         integer NOT NULL,
    sort_order              smallint NOT NULL DEFAULT 0,
    UNIQUE (building_id, lift_id)
);

CREATE TABLE core.gateway (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id          uuid NOT NULL REFERENCES core.site(id),
    code             text NOT NULL,          -- e.g. 'GW-WHZ-01'
    gateway_type     text NOT NULL CHECK (gateway_type IN ('REAL', 'SIM')),
    heartbeat_sec    integer NOT NULL DEFAULT 10,
    hostname         text,
    UNIQUE (site_id, code)
);

CREATE TABLE core.gateway_binding (
    elevator_id      uuid PRIMARY KEY REFERENCES core.elevator(id),
    gateway_id       uuid NOT NULL REFERENCES core.gateway(id),
    device_address   smallint NOT NULL,      -- = lift_id at the wire level
    UNIQUE (gateway_id, device_address)
);

CREATE TABLE core.signal_point (
    elevator_id  uuid NOT NULL REFERENCES core.elevator(id),
    point        text NOT NULL CHECK (point IN
        ('VS2','VS3','VS4','VS5','VS6','VS7','RUNNING','SAFETY_DEVICE','UP','DN',
         'FIRE_OPERATION','FIRE_RETURN','DOOR_OPEN')),
        -- DOOR_OPEN is valid only on SIMULATED elevators (no door signal exists on the real
        -- hardware); the WHZ seed never inserts it, the TEST seed does.
    pin          smallint CHECK (pin BETWEEN 2 AND 53),
    enabled      boolean NOT NULL DEFAULT true,
    active_low   boolean NOT NULL DEFAULT true,
    PRIMARY KEY (elevator_id, point)
);

-- Registered producer installations, and the epoch each one currently owns for a stream.
-- An epoch changes ONLY on explicit re-enrollment (operator action after e.g. local
-- durable-storage loss), never on a plain process restart (revised plan section A.6).
CREATE TABLE core.producer_registration (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id      uuid NOT NULL REFERENCES core.gateway(id),
    current_epoch   integer NOT NULL DEFAULT 1,
    registered_at   timestamptz NOT NULL DEFAULT now(),
    re_enrolled_at  timestamptz
);

CREATE TABLE core.contract_version (
    version     text PRIMARY KEY,
    status      text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED')),
    applied_at  timestamptz NOT NULL DEFAULT now(),
    notes       text
);

-- ----------------------------------------------------------- telemetry ----

-- Dedupe authority. Unique on messageId AND on the durable stream tuple -- both checked,
-- per revised plan section A.5/A.6 (R11: "unique event_time+identity แทน dedupe" -- corrected
-- here to key on the stream tuple, not eventTime, since eventTime is receipt-derived and
-- retries can legitimately carry a different receipt timestamp for the same logical record).
CREATE TABLE telemetry.ingest_receipt (
    id                bigserial PRIMARY KEY,
    message_id        uuid NOT NULL UNIQUE,
    producer_id       uuid NOT NULL,
    producer_epoch    integer NOT NULL,
    stream_id         uuid NOT NULL,
    stream_seq        bigint NOT NULL CHECK (stream_seq BETWEEN 1 AND 9223372036854775807),
    payload_hash      text NOT NULL,
    result            text NOT NULL DEFAULT 'PENDING'
        CHECK (result IN ('PENDING', 'COMMITTED', 'REJECTED')),
    received_at       timestamptz NOT NULL DEFAULT now(),
    committed_at      timestamptz,
    UNIQUE (producer_id, producer_epoch, stream_id, stream_seq)
);

-- Monthly range-partitioned. NOTE (test P02): a Postgres unique index on a partitioned
-- table must include the partition key -- event_time leads the unique constraint here for
-- exactly that reason (revised plan section A.9, [T3]).
CREATE TABLE telemetry.events (
    event_time      timestamptz NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now(),
    id              bigserial,
    elevator_id     uuid,                    -- NULL only for Gateway-lifecycle events
    gateway_id      uuid NOT NULL,
    producer_id     uuid NOT NULL,
    producer_epoch  integer NOT NULL,
    stream_id       uuid NOT NULL,
    stream_seq      bigint NOT NULL,
    event_type      text NOT NULL,
    point           text,
    prev_value      jsonb,
    next_value      jsonb,
    data            jsonb NOT NULL DEFAULT '{}'::jsonb,
    origin          text NOT NULL CHECK (origin IN ('LIVE', 'SIMULATED', 'IMPORT')),
    PRIMARY KEY (event_time, id),
    UNIQUE (event_time, producer_id, producer_epoch, stream_id, stream_seq)
) PARTITION BY RANGE (event_time);

CREATE INDEX events_elevator_time_idx ON telemetry.events (elevator_id, event_time DESC);
CREATE INDEX events_type_time_idx ON telemetry.events (event_type, event_time DESC);

-- Bootstrap partitions for the rollout window. PartitionKeeper (P2/P3 application code)
-- extends this at runtime -- this migration only guarantees the database is usable from
-- day one, not that partitions exist forever (revised plan section A.9, test P02).
CREATE TABLE telemetry.events_2026_09 PARTITION OF telemetry.events
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE telemetry.events_2026_10 PARTITION OF telemetry.events
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE telemetry.events_2026_11 PARTITION OF telemetry.events
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

-- Current state per elevator. The monotonic-upsert predicate application code must use:
--   same producer_epoch AND stream_seq > current stream_seq  -> apply
--   OR different (newer, re-enrolled) producer_epoch          -> apply
--   otherwise                                                  -> IGNORED_OLDER, no-op
-- This is what makes backlog replay and out-of-order delivery safe (test I10, O01, O03).
CREATE TABLE telemetry.current_state (
    elevator_id           uuid PRIMARY KEY REFERENCES core.elevator(id),
    gateway_id            uuid NOT NULL,
    producer_id           uuid NOT NULL,
    producer_epoch        integer NOT NULL,
    stream_id             uuid NOT NULL,
    stream_seq            bigint NOT NULL,
    event_time            timestamptz NOT NULL,
    received_at           timestamptz NOT NULL DEFAULT now(),
    origin                text NOT NULL CHECK (origin IN ('LIVE', 'SIMULATED', 'IMPORT')),
    floor_raw             text,
    direction              text NOT NULL DEFAULT 'UNKNOWN',
    motion                 text NOT NULL DEFAULT 'UNKNOWN',
    operating_mode         text NOT NULL DEFAULT 'UNKNOWN',
    status_points          jsonb NOT NULL DEFAULT '{}'::jsonb,
    data_quality           jsonb NOT NULL DEFAULT '{}'::jsonb,
    reemit                 boolean NOT NULL DEFAULT false,
    server_state_revision  bigint NOT NULL DEFAULT 1
);

CREATE TABLE telemetry.gateway_status (
    gateway_id       uuid PRIMARY KEY REFERENCES core.gateway(id),
    connection_state text NOT NULL DEFAULT 'UNKNOWN'
        CHECK (connection_state IN ('ONLINE', 'AWAITING_FRESH_PROOF', 'OFFLINE', 'UNKNOWN')),
    connection_id    uuid,
    connection_seq   integer NOT NULL DEFAULT 0,
    last_heartbeat_at timestamptz,
    agent_version    text
);

-- Explicit, queryable record of known data gaps -- so "no data" and "confirmed offline for
-- this exact window" are distinguishable when reviewing history (revised plan section A.9).
CREATE TABLE telemetry.observation_gap (
    id           bigserial PRIMARY KEY,
    elevator_id  uuid NOT NULL REFERENCES core.elevator(id),
    started_at   timestamptz NOT NULL,
    ended_at     timestamptz,
    reason       text
);

CREATE TABLE telemetry.realtime_outbox (
    id          bigserial PRIMARY KEY,
    elevator_id uuid,
    kind        text NOT NULL,
    payload     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    dispatched_at timestamptz
);

-- ---------------------------------------------------------------- alarm ----

CREATE TABLE alarm.definition (
    code         text PRIMARY KEY,
    name         text NOT NULL,
    severity     text NOT NULL CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'WARNING')),
    enabled      boolean NOT NULL DEFAULT true,
    scope_tags   text[] NOT NULL DEFAULT '{}',
    params       jsonb NOT NULL DEFAULT '{}'::jsonb,
    auto_clear   boolean NOT NULL DEFAULT true
);

CREATE TABLE alarm.instance (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_code  text NOT NULL REFERENCES alarm.definition(code),
    elevator_id      uuid REFERENCES core.elevator(id),
    gateway_id       uuid REFERENCES core.gateway(id),
    severity         text NOT NULL,
    -- condition (ACTIVE/CLEARED) is deliberately separate from workflow (ACKED/CLOSED) --
    -- revised plan section F.2: an ACK must never clear a condition that is still true.
    state            text NOT NULL CHECK (state IN ('ACTIVE', 'ACKED', 'CLEARED', 'CLOSED')),
    muted            boolean NOT NULL DEFAULT false,
    dedupe_key       text NOT NULL,
    raised_at        timestamptz NOT NULL,
    acked_at         timestamptz,
    cleared_at       timestamptz,
    closed_at        timestamptz,
    context          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX alarm_instance_open_uq ON alarm.instance (dedupe_key)
    WHERE state IN ('ACTIVE', 'ACKED');

CREATE TABLE alarm.action (
    id            bigserial PRIMARY KEY,
    instance_id   uuid NOT NULL REFERENCES alarm.instance(id),
    action        text NOT NULL CHECK (action IN ('ACK', 'MUTE', 'UNMUTE', 'CLOSE', 'COMMENT')),
    actor_user_id uuid,
    at            timestamptz NOT NULL DEFAULT now(),
    note          text
);

-- -------------------------------------------------------------- command ----

-- DRY_RUN only in this migration's constraints -- a LIVE row on a REAL-tagged elevator is
-- rejected at the database level, not merely at the API (revised plan section 1.3, test S05).
CREATE TABLE command.request (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key      text UNIQUE NOT NULL,
    elevator_id          uuid NOT NULL REFERENCES core.elevator(id),
    command_type         text NOT NULL,
    mode                 text NOT NULL CHECK (mode IN ('DRY_RUN', 'LIVE')),
    state                text NOT NULL CHECK (state IN
        ('REQUESTED','PENDING_APPROVAL','APPROVED','DISPATCHED','ACCEPTED','EXECUTED',
         'REJECTED','FAILED','TIMED_OUT','CANCELLED')),
    requested_by         uuid NOT NULL,
    approved_by          uuid,
    requested_at         timestamptz NOT NULL DEFAULT now(),
    result_code          text CHECK (result_code IN ('SIMULATED_SUCCESS', 'DRY_RUN_COMPLETED') OR result_code IS NULL),
    CHECK (requested_by <> approved_by)
);

-- --------------------------------------------------------------- auth -----

CREATE TABLE auth."user" (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username      text UNIQUE NOT NULL,
    display_name  text NOT NULL,
    role          text NOT NULL CHECK (role IN ('operator', 'supervisor', 'technician', 'admin')),
    password_hash text NOT NULL,
    enabled       boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------- audit ----

CREATE TABLE audit.log (
    id             bigserial PRIMARY KEY,
    at             timestamptz NOT NULL DEFAULT now(),
    actor_user_id  uuid,
    actor_role     text,
    action         text NOT NULL,
    target_type    text,
    target_id      text,
    source         text NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'demo')),
    details        jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO core.contract_version (version, status, notes)
VALUES ('2.0.0-draft.1', 'DRAFT', 'A-DRAFT round, PRE-0/A-DRAFT -- not applied to any real database in this round');

-- migrate:down
DROP SCHEMA audit CASCADE;
DROP SCHEMA auth CASCADE;
DROP SCHEMA command CASCADE;
DROP SCHEMA alarm CASCADE;
DROP SCHEMA telemetry CASCADE;
DROP SCHEMA core CASCADE;
