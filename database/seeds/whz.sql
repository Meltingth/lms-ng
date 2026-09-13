-- WHZ (Whizdom The Forestias) seed data -- REAL site.
-- Idempotent: safe to run more than once (ON CONFLICT DO UPDATE).
-- Status DRAFT -- not applied to any real database in this round (no Postgres instance
-- reachable, see docs/preflight/MACHINE_CAPABILITIES.md section 5).

INSERT INTO core.organization (id, code, name, timezone)
VALUES ('00000000-0000-4000-8000-000000000001', 'smartconcept', 'Smart Concept IoT', 'Asia/Bangkok')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO core.site (id, organization_id, code, name, timezone, topic_root)
VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
        'whz', 'Whizdom The Forestias', 'Asia/Bangkok',
        'lms/v2/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002')
ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO core.building (id, site_id, code, name)
VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
        'WHZ', 'The Whizdom')
ON CONFLICT (site_id, code) DO UPDATE SET name = EXCLUDED.name;

-- ------------------------------------------------------------ floor profiles ----

INSERT INTO core.floor_profile (id, name, notes) VALUES
    ('WHZ-PAX', 'Passenger W-01..W-04', 'Closed table per CLAUDE.md section 3.4, verified 12 Sep 2026'),
    ('WHZ-SERVICE', 'Lift Service W-05', 'Top code 47 confirmed by blind test 12 Sep 2026 18:31; codes 3..46 not yet calibrated')
ON CONFLICT (id) DO UPDATE SET notes = EXCLUDED.notes;

INSERT INTO core.floor_profile_version (profile_id, version, effective_from)
VALUES ('WHZ-PAX', 1, '2026-09-12T00:00:00+07:00'),
       ('WHZ-SERVICE', 1, '2026-09-13T00:00:00+07:00')
ON CONFLICT (profile_id, version) DO NOTHING;

-- WHZ-PAX: the closed table. 46 codes, 43 landings, codes 4/9/11 are transit-only (the car
-- passes through, no landing). Verified against all 10 owner-confirmed calibration anchors
-- (1->B1, 2->1, 12->9, 22->20, 28->26, 34->32, 35->33, 38->36, 39->37, 46->44) by a standalone
-- arithmetic check before this file was written -- see docs/evidence/A-DRAFT_report.md.
INSERT INTO core.floor_mapping (profile_id, version, code, label, is_landing, calibrated, evidence_type) VALUES
    ('WHZ-PAX', 1, 1,  'B1', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 2,  '1',  true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 3,  '2',  true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 4,  NULL, false, true, 'OBSERVED'),   -- transit: no landing occurred in ~7,000 recorded stops
    ('WHZ-PAX', 1, 5,  '3',  true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 6,  '4',  true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 7,  '5',  true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 8,  '6',  true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 9,  NULL, false, true, 'OBSERVED'),   -- transit
    ('WHZ-PAX', 1, 10, '8',  true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 11, NULL, false, true, 'OBSERVED'),   -- transit
    ('WHZ-PAX', 1, 12, '9',  true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 13, '10', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 14, '11', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 15, '12', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 16, '13', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 17, '14', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 18, '15', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 19, '16', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 20, '17', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 21, '18', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 22, '20', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 23, '21', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 24, '22', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 25, '23', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 26, '24', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 27, '25', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 28, '26', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 29, '27', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 30, '28', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 31, '29', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 32, '30', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 33, '31', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 34, '32', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 35, '33', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 36, '34', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 37, '35', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 38, '36', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 39, '37', true,  true, 'OPERATOR_CONFIRMED'),
    ('WHZ-PAX', 1, 40, '38', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 41, '39', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 42, '40', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 43, '41', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 44, '42', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 45, '43', true,  true, 'OBSERVED'),
    ('WHZ-PAX', 1, 46, '44', true,  true, 'OPERATOR_CONFIRMED')
ON CONFLICT (profile_id, version, code) DO NOTHING;   -- immutable: never UPDATE a shipped version

-- WHZ-SERVICE: owner decision, unchanged by this round -- 1->B1, 2->1, 47->44 calibrated;
-- 3..46 present but UNCALIBRATED (renders as "code N" until the floor-20 stop test closes
-- the gap). The passenger table's transit codes (4, 9, 11) are NOT reused here -- W-05 runs
-- a physically different shaft profile and nothing about its middle floors is known yet.
INSERT INTO core.floor_mapping (profile_id, version, code, label, is_landing, calibrated, evidence_type) VALUES
    ('WHZ-SERVICE', 1, 1,  'B1', true, true, 'OPERATOR_CONFIRMED'),
    ('WHZ-SERVICE', 1, 2,  '1',  true, true, 'OPERATOR_CONFIRMED'),
    ('WHZ-SERVICE', 1, 47, '44', true, true, 'OPERATOR_CONFIRMED')
ON CONFLICT (profile_id, version, code) DO NOTHING;

INSERT INTO core.floor_mapping (profile_id, version, code, label, is_landing, calibrated, evidence_type)
SELECT 'WHZ-SERVICE', 1, gs, NULL, true, false, 'INFERRED'
FROM generate_series(3, 46) AS gs
ON CONFLICT (profile_id, version, code) DO NOTHING;

-- guard: reproduce the exact counts and anchors this seed is supposed to encode
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM core.floor_mapping WHERE profile_id = 'WHZ-PAX' AND version = 1) = 46;
    ASSERT (SELECT count(*) FROM core.floor_mapping WHERE profile_id = 'WHZ-PAX' AND version = 1 AND is_landing) = 43;
    ASSERT (SELECT string_agg(label, ',' ORDER BY code)
            FROM core.floor_mapping
            WHERE profile_id = 'WHZ-PAX' AND version = 1
              AND code IN (1, 2, 12, 22, 28, 34, 35, 38, 39, 46))
           = 'B1,1,9,20,26,32,33,36,37,44';
    ASSERT (SELECT count(*) FROM core.floor_mapping WHERE profile_id = 'WHZ-SERVICE' AND version = 1 AND calibrated) = 3;
    ASSERT (SELECT count(*) FROM core.floor_mapping WHERE profile_id = 'WHZ-SERVICE' AND version = 1 AND NOT calibrated) = 44;
END $$;

-- ------------------------------------------------------------ signal config ----

INSERT INTO core.signal_config_version (id, description) VALUES
    ('whz-pax-1', 'Reference wiring, D24-D29 VS2-VS7, D16 RUNNING, D17 SAFETY, D19 UP, D20 DN'),
    ('whz-service-1', 'Same pin map as whz-pax-1; profile differs only in floor mapping')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- gateway ----

INSERT INTO core.gateway (id, site_id, code, gateway_type, heartbeat_sec, hostname)
VALUES ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002',
        'GW-WHZ-01', 'REAL', 10, NULL)
ON CONFLICT (site_id, code) DO UPDATE SET gateway_type = EXCLUDED.gateway_type;

INSERT INTO core.producer_registration (gateway_id, current_epoch)
VALUES ('00000000-0000-4000-8000-000000000004', 1)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------- elevators ----

-- lift_id values, commissioning/service status: from CLAUDE.md section 9.6/3.0 as of
-- 13 Sep 2026 -- lifts 1/2/3/5 are commissioned and capturing today; lift 4 is out of
-- service (a wiring/hardware state) but REMAINS commissioned (R12) -- it is NOT the same
-- as "never installed", so it must not render as PENDING_INSTALL.
INSERT INTO core.elevator
    (id, building_id, code, display_name, lift_id, tags,
     commissioning_status, service_status, monitoring_enabled,
     floor_profile_id, gateway_type, stale_after_sec, sort_order)
VALUES
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000003',
     'W-01', 'โดยสาร 01', 1, '{REAL}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-PAX', 'REAL', 90, 1),
    ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003',
     'W-02', 'โดยสาร 02', 2, '{REAL}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-PAX', 'REAL', 90, 2),
    ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003',
     'W-03', 'โดยสาร 03', 3, '{REAL}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-PAX', 'REAL', 90, 3),
    ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000003',
     'W-04', 'โดยสาร 04', 4, '{REAL}', 'COMMISSIONED', 'OUT_OF_SERVICE', false, 'WHZ-PAX', 'REAL', 90, 4),
    ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000003',
     'W-05', 'Lift Service', 5, '{REAL}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-SERVICE', 'REAL', 90, 5)
ON CONFLICT (building_id, lift_id) DO UPDATE SET
    commissioning_status = EXCLUDED.commissioning_status,
    service_status = EXCLUDED.service_status,
    monitoring_enabled = EXCLUDED.monitoring_enabled;

INSERT INTO core.gateway_binding (elevator_id, gateway_id, device_address)
SELECT id, '00000000-0000-4000-8000-000000000004', lift_id
FROM core.elevator WHERE building_id = '00000000-0000-4000-8000-000000000003'
ON CONFLICT (elevator_id) DO NOTHING;

INSERT INTO core.signal_point (elevator_id, point, pin, enabled)
SELECT e.id, p.point, p.pin, p.enabled
FROM core.elevator e
CROSS JOIN (VALUES
    ('VS2', 24, true), ('VS3', 25, true), ('VS4', 26, true),
    ('VS5', 27, true), ('VS6', 28, true), ('VS7', 29, true),
    ('RUNNING', 16, true), ('SAFETY_DEVICE', 17, true),
    ('UP', 19, true), ('DN', 20, true),
    ('FIRE_OPERATION', NULL, false), ('FIRE_RETURN', NULL, false)
) AS p(point, pin, enabled)
WHERE e.building_id = '00000000-0000-4000-8000-000000000003'
ON CONFLICT (elevator_id, point) DO NOTHING;

-- ------------------------------------------------------------ alarm defs ----

INSERT INTO alarm.definition (code, name, severity, enabled, scope_tags, params, auto_clear) VALUES
    ('SAFETY_DEVICE_TRIP',   'Safety device open',     'MAJOR',   true,  '{REAL,SIMULATED}', '{"minOpenSec":2}', true),
    ('INTERFACE_NO_RXTX',    'No serial data',         'MAJOR',   true,  '{REAL}',           '{"afterSec":90}',  true),
    ('GATEWAY_OFFLINE',      'Gateway offline',        'CRITICAL',true,  '{}',               '{}',               true),
    ('STALE_DATA',           'Stale telemetry',        'MINOR',   true,  '{REAL,SIMULATED}', '{}',               true),
    ('POSITION_BIT_SUSPECT', 'Position bit suspect',   'MAJOR',   true,  '{REAL}',           '{"silentChanges":8}', true),
    ('DATA_QUALITY',         'Rejected serial lines',  'WARNING', true,  '{REAL}',           '{"rejectedLines":1}', true),
    ('FIRE_OPERATION',       'Fire operation',         'CRITICAL',false, '{REAL}',           '{}',               true),
    ('FIRE_RETURN',          'Fire return',             'CRITICAL',false, '{REAL}',           '{}',               true),
    ('DOOR_OBSTRUCTION',     'Door obstruction',       'MAJOR',   true,  '{SIMULATED}',      '{}',               true)
ON CONFLICT (code) DO UPDATE SET
    severity = EXCLUDED.severity, enabled = EXCLUDED.enabled, params = EXCLUDED.params;

-- ------------------------------------------------------------------ users ----
-- password_hash values are NOT real credentials -- placeholder argon2id-shaped strings for
-- schema/fixture testing only. P0-SERVER generates real dev credentials outside git.
INSERT INTO auth."user" (username, display_name, role, password_hash) VALUES
    ('joy',  'Joy',  'operator',   '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder'),
    ('krit', 'Krit', 'supervisor', '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder'),
    ('beam', 'Beam', 'technician', '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder'),
    ('oat',  'Oat',  'admin',      '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder')
ON CONFLICT (username) DO NOTHING;
