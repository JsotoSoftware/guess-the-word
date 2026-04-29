# Realtime events implemented so far

## Bootstrap
- `server:ready`
- `client:ping`

## Phase 3.1 room flow
- `room:create`
- `room:join`
- `room:state`

Current scope:
- room creation with host assignment
- room join by code and nickname
- lobby snapshot broadcast to connected room members
- validation for missing room, closed room, full room, duplicated nickname, and invalid settings
