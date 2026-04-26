# Realtime bootstrap events

Temporary Phase 1.3 websocket events:

- `server:ready`
  - emitted by server on initial socket connection
- `client:ping`
  - client can send a ping payload
- response: `{ message: 'pong', serverTime, receivedTimestamp }`

These are bootstrap-only events to verify the Socket.IO/NestJS integration before the real room/game event contracts are implemented.
