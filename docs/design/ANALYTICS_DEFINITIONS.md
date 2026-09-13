# Analytics boundaries — first HUD milestone

NOT_RUN: Trip counts, runtime/stopped duration, floor visits, data coverage, operational availability, passenger/load metrics and latency statistics are not calculated in this milestone.

PASS: The analytics panel displays an em dash with an explicit unavailable/unmeasured explanation. Missing history is not shown as zero, and no synthetic passenger counts or availability percentages are presented.

PASS: Visible instantaneous summaries are scoped to the local fixture snapshot:

- Total lifts: number of snapshot elevator records.
- Monitoring enabled: count of monitoringEnabled=true, independent of service/connection.
- Fresh channels: monitored elevators whose supplied connectionState is ONLINE and whose local freshness is not stale.
- Out of service: count with serviceStatus=OUT_OF_SERVICE.
- Active alarm count: sum only when every record supplies activeAlarmCount; otherwise UNKNOWN.

These are local TEST snapshot counts, not measured real operational availability.

BLOCKED: Architect/Backend definitions are needed for trip boundaries (start/stop/arrival), gap inclusion, clock uncertainty, sample windows, incomplete trips, source/site filtering, event-time vs receipt-time aggregation, and coverage denominators. Define them before implementing historical charts.

NOT_RUN: API/WebSocket/field latency, HUD FPS, CPU, memory growth and long-duration load. Browser QA only checks bounded CSS geometry and interaction behavior; it does not establish a performance SLA.
