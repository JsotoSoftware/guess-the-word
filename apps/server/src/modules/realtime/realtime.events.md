# Realtime events implemented so far

## Bootstrap
- `server:ready`
- `client:ping`

## Phase 3.1 / 3.2 room flow
- `room:create`
- `room:join`
- `room:update_settings`
- `room:leave`
- `room:state`

Current scope:
- room creation with host assignment
- room join by code and nickname
- real-time synchronized lobby snapshot for all room members
- host-only room settings editing while the room is in lobby
- leave-room handling with host transfer when needed
- validation for missing room, closed room, full room, duplicated nickname, invalid settings, and non-host actions
