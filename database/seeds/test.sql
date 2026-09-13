-- TEST site seed data -- SIMULATED only. Nothing here ever shares an ID with the WHZ seed
-- (docs/preflight/DATA_CLASSIFICATION.md; revised plan section C.4 real-ID guard).

INSERT INTO core.organization (id, code, name, timezone)
VALUES ('99999999-0000-4000-8000-000000000001', 'test-org', 'Test Organization', 'Asia/Bangkok')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO core.site (id, organization_id, code, name, timezone, topic_root)
VALUES ('99999999-0000-4000-8000-000000000002', '99999999-0000-4000-8000-000000000001',
        'test', 'Test Site', 'Asia/Bangkok',
        'lms-sim/v2/99999999-0000-4000-8000-000000000001/99999999-0000-4000-8000-000000000002')
ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO core.building (id, site_id, code, name)
VALUES ('99999999-0000-4000-8000-000000000003', '99999999-0000-4000-8000-000000000002',
        'TEST', 'Test Building')
ON CONFLICT (site_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO core.gateway (id, site_id, code, gateway_type, heartbeat_sec)
VALUES ('99999999-0000-4000-8000-000000000004', '99999999-0000-4000-8000-000000000002',
        'GW-SIM-01', 'SIM', 10)
ON CONFLICT (site_id, code) DO UPDATE SET gateway_type = EXCLUDED.gateway_type;

INSERT INTO core.producer_registration (gateway_id, current_epoch)
VALUES ('99999999-0000-4000-8000-000000000004', 1)
ON CONFLICT DO NOTHING;

INSERT INTO core.elevator
    (id, building_id, code, display_name, lift_id, tags,
     commissioning_status, service_status, monitoring_enabled,
     floor_profile_id, gateway_type, stale_after_sec, sort_order)
VALUES
    ('99999999-0000-4000-8000-000000000021', '99999999-0000-4000-8000-000000000003',
     'S-01', 'Simulated 01', 1, '{SIMULATED}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-PAX', 'SIM', 30, 1),
    ('99999999-0000-4000-8000-000000000022', '99999999-0000-4000-8000-000000000003',
     'S-02', 'Simulated 02', 2, '{SIMULATED}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-PAX', 'SIM', 30, 2),
    ('99999999-0000-4000-8000-000000000023', '99999999-0000-4000-8000-000000000003',
     'S-03', 'Simulated 03', 3, '{SIMULATED}', 'COMMISSIONED', 'IN_SERVICE', true, 'WHZ-PAX', 'SIM', 30, 3)
ON CONFLICT (building_id, lift_id) DO NOTHING;

INSERT INTO core.gateway_binding (elevator_id, gateway_id, device_address)
SELECT id, '99999999-0000-4000-8000-000000000004', lift_id
FROM core.elevator WHERE building_id = '99999999-0000-4000-8000-000000000003'
ON CONFLICT (elevator_id) DO NOTHING;

-- Simulated elevators additionally expose DOOR_OPEN, which no real elevator publishes (there
-- is no door signal on the actual hardware) -- this is the one row that differs from the WHZ
-- seed's signal_point set, and it is scoped to the TEST building only.
INSERT INTO core.signal_point (elevator_id, point, pin, enabled)
SELECT e.id, p.point, p.pin, p.enabled
FROM core.elevator e
CROSS JOIN (VALUES
    ('VS2', 24, true), ('VS3', 25, true), ('VS4', 26, true),
    ('VS5', 27, true), ('VS6', 28, true), ('VS7', 29, true),
    ('RUNNING', 16, true), ('SAFETY_DEVICE', 17, true),
    ('UP', 19, true), ('DN', 20, true),
    ('DOOR_OPEN', NULL, true)
) AS p(point, pin, enabled)
WHERE e.building_id = '99999999-0000-4000-8000-000000000003'
ON CONFLICT (elevator_id, point) DO NOTHING;
