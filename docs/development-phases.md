# Guess the Word — Project Context and Development Phases

## 1. Project context

### Product summary
Guess the Word is a multiplayer word guessing web game inspired by Wordle-style feedback.
Players join a room and play across multiple rounds using a shared hidden word per round.
The application supports two game modes:

- **PVP mode**
  - All players guess the same hidden word at the same time
  - Each player has their own attempts
  - Rounds may have a timer if the room enables it
  - Players earn points for correct answers
  - The first, second, and third correct players receive extra bonus points
  - Requires at least 2 players to start
- **Co-op mode**
  - All players guess the same hidden word together
  - The room shares the same attempt pool
  - No timer
  - No point scoring
  - Progress is measured by rounds completed / rounds won
  - Can be started alone or with other players

### Core gameplay rules
- The hidden word is not shown directly
- Only the number of letter boxes is shown
- A guess must match the secret word length
- The game does not require guesses to exist in a dictionary
- Feedback is returned per letter:
  - **Green**: correct letter in the correct position
  - **Yellow**: correct letter in the wrong position
  - **Red**: letter is not in the word
- Players have a fixed number of attempts before the round is lost

### Room features
- Players can create and join rooms
- Room settings include:
  - game mode
  - number of rounds
  - attempts per round
  - optional timer per round for PVP
  - guess submission mode: auto-send or manual submit
  - optional max players
- All players in the room play the same word each round
- PVP rooms require at least 2 players to start
- Co-op rooms can start with 1 player or more
- Rooms include a live room-only chat
- Chat is ephemeral and disappears when the room closes

### Technical constraints and preferences
- Frontend web application
- Real-time multiplayer backend
- Persistent word storage in a database
- Ephemeral room and chat state should disappear when the room ends
- **No ORM**
- Database access should use **raw SQL**
- **Slonik** will be used as the PostgreSQL client layer to keep a SQL-first workflow while testing a safer alternative to plain `pg`

---

## 2. Recommended technical direction

### Frontend
Two good choices exist:

#### Option A — React + Vite
Best if the product is mainly a client-side game app.

**Pros**
- simpler setup
- very fast dev server
- less framework overhead
- ideal for SPA-style real-time apps

**Cons**
- fewer built-in app features than Next.js
- if you later want SSR, SEO-heavy marketing pages, or server components, you will add that separately

#### Option B — Next.js
Best if you want a stronger full-stack web framework from the start.

**Pros**
- built-in routing and app structure
- good for landing pages, SEO, docs, and future auth/account pages
- convenient deployment on platforms like Vercel
- useful if the product grows beyond the game screen itself

**Cons**
- more framework complexity than Vite
- some features are unnecessary for an MVP real-time game

### Recommendation for this project
Because this product is primarily a **real-time room-based game**, **React + Vite** is a very strong choice for the frontend MVP.
If later you want a richer website around the game, you can still migrate or add Next.js patterns later.

### Backend
**NestJS + Socket.IO + TypeScript**

Why NestJS:
- better structure for a growing backend
- clean separation by module: rooms, game, chat, words, scoring
- easier to maintain when real-time logic becomes more complex
- good fit for WebSockets, validation, and testing

Alternative:
- **Express** or **Fastify** if you want a lighter, more minimal backend for the first version

### Database
**PostgreSQL**

Why:
- great for structured data
- good for word lists, room settings, score history, player history
- excellent support for raw SQL

### Live ephemeral state
**Redis**

Use for:
- active room state
- presence
- timers
- temporary chat messages
- cleanup of abandoned rooms

### SQL approach
Since no ORM should be used:
- use **Slonik** for PostgreSQL access
- write SQL manually using Slonik SQL templates
- keep a SQL-first approach with repository/query modules
- prefer parameterized queries only
- use a migration tool like:
  - `dbmate`, or
  - plain SQL migration files executed by scripts

Why Slonik for this project:
- still SQL-first, without moving to an ORM
- safer query composition than ad-hoc string building
- good fit for PostgreSQL
- useful middle ground while testing something more structured than plain `pg`

---

## 3. Suggested project structure

```text
guess-the-word/
  apps/
    web/                    # React + Vite frontend
    server/                 # NestJS backend
  packages/
    shared/                 # shared TS types, constants, validation schemas
  docs/
    development-phases.md
```

### Frontend structure
```text
apps/web/src/
  components/
    game/
    lobby/
    chat/
    scoreboard/
    common/
  pages/ or routes/
  hooks/
  store/
  services/
    api/
    socket/
  types/
```

### Backend structure
```text
apps/server/src/
  modules/
    rooms/
    game/
    chat/
    words/
    players/
    scoring/
  db/
    migrations/
    queries/
  config/
  shared/
  main.ts
```

---

## 4. High-level system design

### Frontend responsibilities
- render lobby, room, game board, chat, and scoreboard
- send user actions to backend
- display server-authoritative state
- handle reconnect UX

### Backend responsibilities
- create and manage rooms
- validate settings and guesses
- choose words
- evaluate guesses and generate color results
- manage round state, attempts, timers, and scoring
- broadcast real-time updates
- delete room-scoped ephemeral state when room closes

### Database responsibilities
- store word list
- store game configuration defaults if needed
- store historical results if persistence is desired
- store optional player/account data later

### Redis responsibilities
- active room state
- current round state
- live chat messages
- timer state
- room expiration / cleanup markers

---

## 5. Game rules to lock before implementation

These should be finalized before coding the core backend logic.

### Shared rules
- allowed word lengths
- secret word source and language(s)
- whether guesses should accept any letter sequence or only alphabetic input
- guess submission mode behavior: auto-send vs manual submit
- duplicate-letter evaluation rules
- what happens if a player disconnects during a round
- room closure conditions
- minimum players required to start by mode

### PVP rules
- attempts per player
- timer length per round when enabled
- fixed points for correct answer
- first-place bonus
- second-place bonus
- third-place bonus
- tie resolution if answers arrive nearly simultaneously
- whether all players continue after first correct answer or round ends on timer / all finished

### Co-op rules
- shared attempt count per room
- whether all players can submit simultaneously
- whether duplicate simultaneous submissions are accepted
- whether wrong guesses consume one shared attempt regardless of who sent it
- whether co-op success is counted only as round win/loss

---

## 6. Development phases and milestones

---

# Phase 0 — Product definition and rule specification

## Goal
Remove ambiguity before implementation starts.

## Subphase 0.1 — Finalize game rules
Define and document:
- PVP round lifecycle
- Co-op round lifecycle
- scoring formula
- timer behavior
- guess submission behavior
- attempt behavior
- tie handling
- reconnect handling
- room host permissions
- minimum players required to start by mode

### Deliverable
- `docs/game-rules.md`

### Testable actions
Documentation only. No runtime test required.

#### Review checklist
- Confirm PVP and Co-op rules do not conflict
- Confirm scoring and finish-order rules are explicit
- Confirm timer rules are explicit
- Confirm guess submission rules are explicit
- Confirm invalid guess handling is explicit
- Confirm reconnect/disconnect behavior is documented or marked TBD intentionally
- Confirm minimum player requirements by mode are explicit


## Subphase 0.2 — Define UX flow
Define the screens and transitions:
- landing page
- create room flow
- join room flow
- lobby
- in-game screen
- round-end summary
- final results
- error and fallback states
- room-state-based navigation approach

### Deliverable
- low-fidelity wireframes or screen map

### Testable actions
Documentation only. No runtime test required.

#### Review checklist
- Confirm every major page/screen is represented
- Confirm screen-to-screen transitions are defined
- Confirm host/player actions are represented in the flow
- Confirm both PVP and Co-op screens are accounted for
- Confirm room-level auto-send/manual submit behavior is represented
- Confirm minimum-player-to-start behavior is represented
- Confirm round summary continue/auto-advance behavior is represented
- Confirm chat in both lobby and in-game is represented


## Subphase 0.3 — Define data contracts
Define the objects and event payloads used by frontend and backend:
- room
- player
- settings
- round state
- guess result
- chat message
- scoreboard entry

### Deliverable
- shared TypeScript types or API contract document

### Testable actions
Documentation only. No runtime test required.

#### Review checklist
- Confirm room, player, round, chat, and score payloads exist
- Confirm backend-to-frontend and frontend-to-backend event payloads are consistent
- Confirm optional vs required fields are clear

## Milestone outcome
A frozen rules and scope baseline for MVP.

### Phase acceptance
- Review the rules, UX flow, and data contracts together
- Confirm there are no contradictions between PVP, Co-op, scoring, timers, and room behavior
- Confirm unresolved decisions are explicitly marked instead of being left ambiguous

---

# Phase 1 — Monorepo and technical foundation

## Goal
Create the project skeleton and development environment.

## Subphase 1.1 — Initialize repository structure
Set up:
- `apps/web`
- `apps/server`
- `packages/shared`
- `docs`

### Deliverable
- running monorepo with package manager workspaces

### Testable actions
#### Automated verification
- Run workspace install successfully
- Run a root-level command that detects all workspaces
- Run lint/typecheck placeholders if configured

#### Manual verification
- Confirm `apps/web`, `apps/server`, `packages/shared`, and `docs` exist
- Confirm dependencies install without errors
- Confirm each workspace has its own package manifest and scripts
- Confirm the root workspace can execute web and server scripts from one place


## Subphase 1.2 — Frontend bootstrap
Set up frontend with:
- React + Vite
- TypeScript
- Tailwind CSS
- routing
- base layout
- environment configuration

### Deliverable
- frontend boots locally with placeholder pages

### Testable actions
#### Automated verification
- Run the frontend dev server successfully
- Run frontend build successfully
- Run typecheck successfully

#### Manual verification
1. Start the frontend dev server
2. Open the local frontend URL in the browser
3. Confirm the app loads without a blank screen or console crash
4. Confirm basic routing works across placeholder pages
5. Confirm Tailwind styles are being applied visibly
6. Refresh the page on a nested route and confirm it still loads


## Subphase 1.3 — Backend bootstrap
Set up backend with:
- NestJS
- Socket.IO
- TypeScript
- config management
- health endpoint
- basic module structure

### Deliverable
- backend boots locally and accepts websocket connections

### Testable actions
#### Automated verification
- Run the backend dev server successfully
- Run backend build successfully
- Run backend typecheck successfully
- Confirm a health endpoint returns success

#### Manual verification
1. Start the backend server
2. Call the health endpoint from the browser or an API client
3. Confirm a successful response is returned
4. Open the frontend and verify it can connect to the backend base URL
5. If websocket bootstrap exists, confirm a test socket connection can be established and disconnected cleanly


## Subphase 1.4 — Database and SQL foundation
Set up:
- PostgreSQL connection using **Slonik**
- SQL migration strategy
- seed strategy for words
- query organization
- a shared database client wrapper and transaction helper

### Deliverable
- database can run migrations and seed scripts

### Testable actions
#### Automated verification
- Run database migrations successfully
- Run database seed scripts successfully
- Run a simple connectivity check through Slonik
- Run a test query against the words table successfully

#### Manual verification
1. Start PostgreSQL
2. Run migrations
3. Inspect the database and confirm expected tables were created
4. Run the seed process
5. Confirm words were inserted
6. Start the backend and verify the application connects to the database without startup errors
7. Trigger a simple endpoint or internal command that reads from the database


## Subphase 1.5 — Shared package foundation
Create shared package for:
- enums
- DTO-like shared types
- event names
- validation schemas if used

### Deliverable
- frontend and backend import shared types from one place

### Testable actions
#### Automated verification
- Run typecheck in the shared package
- Import shared types into both frontend and backend successfully

#### Manual verification
1. Create or use one shared type in the shared package
2. Import it in the frontend
3. Import it in the backend
4. Confirm both apps compile and use the same type definition without duplication

## Milestone outcome
A runnable full-stack skeleton with development tooling in place.

### Phase acceptance
- Install dependencies and start both frontend and backend locally
- Confirm the frontend loads, the backend health check responds, and the database connection works
- Confirm shared types can be imported by both apps without build or type errors

---

# Phase 2 — Word engine and single-round core logic

## Goal
Implement the central word evaluation logic independent of multiplayer.

## Subphase 2.1 — Word storage and retrieval
Build:
- `words` table
- seed scripts
- random word selection query
- secret word filtering rules

### Deliverable
- backend can fetch a valid secret word for a round

### Testable actions
#### Automated verification
- Test fetching a random word by length
- Test rejecting lengths with no available words
- Test inactive words are not returned if active filtering is used
- Test secret word filters such as language or difficulty if they are implemented

#### Manual verification
1. Insert a small known set of words into the database
2. Trigger word selection for a chosen length
3. Confirm only words of that length are returned
4. Disable or exclude one word if active filtering exists
5. Confirm the excluded word is not returned


## Subphase 2.2 — Guess evaluation engine
Implement server logic for:
- letter comparison
- green/yellow/red result generation
- duplicate letter handling
- invalid guess rejection

### Deliverable
- tested pure function or service for guess evaluation

### Testable actions
#### Automated verification
- Unit test correct-position letters become green
- Unit test wrong-position letters become yellow
- Unit test missing letters become red
- Unit test duplicate-letter edge cases
- Unit test full correct guess detection

#### Manual verification
1. Prepare known secret words and guesses
2. Evaluate a guess with all-correct letters
3. Evaluate a guess with mixed green/yellow/red outcomes
4. Evaluate duplicate-letter scenarios manually
5. Confirm the result matches the expected feedback rules


## Subphase 2.3 — Single-round state model
Define round state structure:
- secret word
- guesses
- attempts remaining
- round status
- winners / finish order where relevant

### Deliverable
- backend service can create and progress a round state

### Testable actions
#### Automated verification
- Test round creation initializes expected state
- Test attempts decrement correctly
- Test round ends on correct guess
- Test round ends on zero attempts
- Test round status cannot progress illegally after completion

#### Manual verification
1. Start a local round with a fixed secret word
2. Submit an incorrect guess and confirm attempts decrease
3. Submit a correct guess and confirm the round completes
4. Start a new round and exhaust all attempts
5. Confirm the round ends in a loss state


## Subphase 2.4 — Minimal frontend game board
Build a local mock UI for:
- word boxes
- letter-box-based guess entry
- optional submit action for manual-submit mode
- colored feedback rows
- attempts display

### Deliverable
- standalone playable local round UI against mocked backend data

### Testable actions
#### Automated verification
- Component tests for board rendering with mock data
- Component tests for row coloring and attempts display
- Test auto-send mode submits when a row becomes full
- Test manual-submit mode requires an explicit submit action
- Test input disables when round is complete if that rule exists

#### Manual verification
1. Load the mock game board UI
2. Confirm the number of boxes matches the target word length
3. Fill the letter boxes for one guess
4. In auto-send mode, confirm the guess is sent when the row becomes full
5. In manual-submit mode, confirm the guess is not sent until submit is pressed
6. Confirm colors render correctly on the board
7. Confirm attempts update correctly
8. Confirm the win and loss states appear correctly

## Milestone outcome
The core game logic works correctly before multiplayer complexity is added.

### Phase acceptance
- Play at least one local or mocked single round end-to-end
- Confirm word lookup, guess validation, color evaluation, attempts, and win/loss states all behave correctly
- Confirm duplicate-letter cases have been manually checked

---

# Phase 3 — Room system and lobby

## Goal
Allow players to create, join, and manage game rooms.

## Subphase 3.1 — Room creation and join flow
Implement:
- room code generation
- create room endpoint / socket flow
- join room flow
- nickname selection
- host assignment
- room settings including timer and guess submission mode

### Deliverable
- multiple clients can join the same room

### Testable actions
#### Automated verification
- Test room code generation uniqueness for normal usage
- Test room creation returns a room and host assignment
- Test join succeeds for a valid room code
- Test join fails for invalid or closed rooms
- Test room creation persists the selected submission mode and other settings in live room state

#### Manual verification
1. Open two browser windows
2. In window A, create a room
3. Select a game mode and choose a guess submission mode
4. Confirm a room code is shown
5. In window B, join using that room code
6. Confirm both users appear in the same room
7. Confirm the selected room settings are visible in the lobby
8. Try joining with an invalid code and confirm the error is handled


## Subphase 3.2 — Lobby state synchronization
Implement:
- player list
- host controls
- room settings editing
- mode-specific start restrictions
- room code copy/share action
- lobby chat visibility
- ready state if applicable
- leave room handling

### Deliverable
- real-time synchronized lobby UI

### Testable actions
#### Automated verification
- Test player join and leave events update room state
- Test settings updates are broadcast to all room members
- Test only host-permitted actions are accepted if host rules exist
- Test PVP start is blocked with fewer than 2 players
- Test Co-op start is allowed with 1 player

#### Manual verification
1. With at least two clients in the same lobby, update a room setting from the host client
2. Confirm the change appears on the other client in real time
3. Switch the submission mode between auto-send and manual submit and confirm the change syncs everywhere
4. In a PVP room with only 1 player, confirm the start action is blocked or disabled with a visible explanation
5. In a Co-op room with only 1 player, confirm the host can still start the match
6. Have one player leave the room
7. Confirm the player list updates everywhere
8. If host-only controls exist, try the same action as a non-host and confirm it is rejected


## Subphase 3.3 — Room lifecycle and cleanup
Implement:
- room open/active/closed states
- idle room timeout
- room cleanup on closure
- temporary room data deletion

### Deliverable
- empty or closed rooms are cleaned up reliably

### Testable actions
#### Automated verification
- Test room closes correctly when intended
- Test idle timeout cleanup removes abandoned rooms
- Test ephemeral state is removed on room closure

#### Manual verification
1. Create a room and join it
2. Close the room or trigger room-end behavior
3. Confirm clients receive a room-closed or redirect event
4. Attempt to rejoin the same room code and confirm it fails
5. Inspect Redis or room state storage and confirm room data is gone

## Milestone outcome
A stable pre-game multiplayer lobby exists.

### Phase acceptance
- Open at least two clients and create/join the same room
- Confirm lobby membership, settings, and host actions stay synchronized in real time
- Confirm PVP start is blocked below 2 players and Co-op can start with 1 player
- Confirm room closure or cleanup works as expected

---

# Phase 4 — PVP mode implementation

## Goal
Implement competitive play with independent attempts and optional timed rounds.

## Subphase 4.1 — PVP round start flow
Implement:
- server selects one secret word for the room
- each player gets independent attempt counters
- optional round timer starts when configured
- all clients receive synchronized round-start event
- selected guess submission mode is applied to the round

### Deliverable
- a full PVP round can begin correctly

### Testable actions
#### Automated verification
- Test a round start picks one secret word for the room
- Test each player receives independent attempts
- Test timer start is broadcast to clients when enabled
- Test no timer state is created when timer is disabled
- Test the selected submission mode is included in the round state

#### Manual verification
1. Create a PVP room with at least two players
2. Start one match with timer enabled and confirm the timer is visible and counting down
3. Start another PVP match with timer disabled and confirm no timer is shown
4. Confirm all players enter the same round
5. Confirm the board size matches the same hidden word length for all players
6. Confirm each player has their own full attempt count
7. Confirm the selected submission mode matches the room setting


## Subphase 4.2 — Guess submission and per-player state
Implement:
- per-player guess handling
- per-player feedback history
- independent attempts remaining
- support for both auto-send and manual submit
- prevention of invalid or duplicate submissions

### Deliverable
- each player can progress independently in the same round

### Testable actions
#### Automated verification
- Test one player's guess does not consume another player's attempts
- Test invalid guesses such as wrong-length input are rejected without corrupting state
- Test guess history remains isolated per player
- Test auto-send submits when a row becomes full
- Test manual-submit requires an explicit action before sending

#### Manual verification
1. In a PVP room using auto-send, fill a row and confirm it submits immediately
2. In a PVP room using manual submit, fill a row and confirm it does not submit until submit is pressed
3. In player A, submit a wrong guess
4. Confirm only player A loses an attempt
5. In player B, verify attempts remain unchanged
6. Submit a valid guess in player B and confirm B receives independent feedback
7. Submit a wrong-length guess and confirm it is rejected properly


## Subphase 4.3 — Finish order and score calculation
Implement:
- correct-answer detection
- finish order tracking
- base points
- first/second/third bonus points
- scoreboard updates

### Deliverable
- scores update correctly and in the right order

### Testable actions
#### Automated verification
- Test base points are awarded for correct answers
- Test first-place bonus is greater than second-place bonus
- Test second-place bonus is greater than third-place bonus
- Test players from fourth onward receive only base points
- Test finish order remains stable once recorded

#### Manual verification
1. Start a PVP round with at least four clients if possible
2. Have players solve in known order
3. Confirm player 1 gets base points plus first bonus
4. Confirm player 2 gets base points plus second bonus
5. Confirm player 3 gets base points plus third bonus
6. Confirm later correct players receive only base points
7. Confirm the scoreboard updates correctly for all clients


## Subphase 4.4 — Timer and round end rules
Implement:
- timer expiration when a timer is enabled
- end when all players are done or timer expires
- reveal secret word
- round summary payload

### Deliverable
- PVP rounds end predictably and cleanly

### Testable actions
#### Automated verification
- Test round ends when timer expires if timer is enabled
- Test round ends when all players are finished
- Test secret word reveal is included in round-end state
- Test no extra guesses are accepted after round end
- Test timer-expiration logic is skipped when the room has no timer

#### Manual verification
1. Start a PVP round with timer enabled
2. Let the timer expire without everyone finishing
3. Confirm the round ends and the word is revealed
4. Start another PVP round with timer disabled and have all players finish normally
5. Confirm the round ends only when all players are finished
6. Attempt to submit a guess after round end and confirm it is rejected

## Milestone outcome
PVP mode is fully playable end-to-end.

### Phase acceptance
- Run a full PVP round with at least two clients
- Confirm independent attempts, optional timer behavior, finish order, and score calculation work correctly
- Confirm both auto-send and manual-submit room settings behave correctly in PVP
- Confirm the round ends cleanly and rejects late guesses

---

# Phase 5 — Co-op mode implementation

## Goal
Implement shared-attempt collaborative play.

## Subphase 5.1 — Shared room-level attempt pool
Implement:
- one common attempt counter for the room
- one shared guess history
- one shared round status
- support for starting Co-op with a single player

### Deliverable
- the room behaves as one team instead of separate players

### Testable actions
#### Automated verification
- Test all players reference the same attempt counter
- Test one wrong guess reduces the shared attempt pool once
- Test shared guess history is visible to all players
- Test a Co-op room can start with one player

#### Manual verification
1. Create a Co-op room with one player and confirm the match can start
2. Create another Co-op room with at least two players
3. Start a round
4. Submit a wrong guess from player A
5. Confirm the shared attempts decrease for both players
6. Confirm the guess appears in the shared board/history for both players


## Subphase 5.2 — Concurrent submissions handling
Implement rules for:
- simultaneous guesses
- invalid duplicate submissions
- ordering when two players submit close together
- whether only one guess is processed at a time
- support for both auto-send and manual submit

### Deliverable
- deterministic co-op guess processing

### Testable actions
#### Automated verification
- Test near-simultaneous guesses are processed deterministically
- Test duplicate submissions are handled according to the chosen rule
- Test state remains consistent under rapid submissions
- Test auto-send submits on row completion in Co-op
- Test manual-submit requires an explicit action before sending in Co-op

#### Manual verification
1. In a Co-op room using auto-send, have two players fill rows almost at the same time
2. Confirm the server processes them in a predictable order
3. Confirm shared attempts are decremented correctly
4. Repeat in manual-submit mode and confirm guesses are not sent until submit is pressed
5. Repeat with duplicate guesses if duplicates are allowed or blocked
6. Confirm no desynchronization appears between clients


## Subphase 5.3 — Co-op round completion rules
Implement:
- win on correct guess
- loss on exhausted shared attempts
- no timer
- no point scoring
- track rounds won / lost only

### Deliverable
- co-op round lifecycle is complete

### Testable actions
#### Automated verification
- Test co-op round win on correct guess
- Test co-op round loss on zero shared attempts
- Test no score entries are generated in Co-op mode
- Test rounds won/lost counters update correctly

#### Manual verification
1. Win one Co-op round by guessing correctly
2. Confirm the round is marked as won
3. Start another Co-op round and exhaust the shared attempts
4. Confirm the round is marked as lost
5. Confirm no point scoreboard is shown or updated


## Subphase 5.4 — Co-op UI adjustments
Implement:
- shared attempts display
- team progress display
- no PVP score UI
- co-op round summary
- UI support for both auto-send and manual submit room settings

### Deliverable
- frontend clearly distinguishes co-op from PVP

### Testable actions
#### Automated verification
- Component tests for shared-attempt display
- Component tests that PVP-only score UI is hidden in Co-op mode
- Component tests for auto-send and manual-submit indicators in Co-op

#### Manual verification
1. Open the game in Co-op mode
2. Confirm the UI shows shared attempts instead of per-player attempts
3. Confirm the scoring/placement UI is not shown
4. Confirm the current submission mode is visible to players
5. Confirm the round summary reflects team success or failure only

## Milestone outcome
Co-op mode is fully playable and behaves differently from PVP where required.

### Phase acceptance
- Run a full Co-op round with one client and with at least two clients
- Confirm attempts are shared, no timer is enforced, and no point scoring appears
- Confirm both auto-send and manual-submit room settings behave correctly in Co-op
- Confirm simultaneous or rapid submissions do not desynchronize the room state

---

# Phase 6 — Chat, presence, and reconnect support

## Goal
Add room social features and resilience.

## Subphase 6.1 — Room chat
Implement:
- room-only chat messages
- timestamped messages
- sender identity
- message broadcast

### Deliverable
- players can chat inside the room in real time

### Testable actions
#### Automated verification
- Test chat message broadcast to all room members
- Test sender name and timestamp are included
- Test chat remains room-scoped

#### Manual verification
1. Open two or more clients in the same room
2. Send a chat message from one client
3. Confirm all room members receive it in real time
4. Open a client in a different room and confirm it does not receive the message


## Subphase 6.2 — Ephemeral chat storage
Implement:
- in-memory or Redis-backed room chat
- deletion when room closes
- cleanup for abandoned rooms

### Deliverable
- chat exists only for the room lifetime

### Testable actions
#### Automated verification
- Test chat is deleted when room closes
- Test abandoned-room cleanup removes stored chat

#### Manual verification
1. Send several messages in a room
2. Confirm they are visible while the room is active
3. Close the room
4. Attempt to restore or reopen the room
5. Confirm previous chat history is no longer available
6. If inspecting Redis manually, confirm the chat key/data is removed


## Subphase 6.3 — Presence and disconnect handling
Implement:
- user connected/disconnected indicators
- temporary disconnect grace period
- reconnect to same room/session if supported

### Deliverable
- room experience is more stable under normal network issues

### Testable actions
#### Automated verification
- Test disconnect updates presence state
- Test reconnect restores session if reconnect support is implemented
- Test expired reconnect windows remove the player correctly

#### Manual verification
1. Join a room with two clients
2. Disconnect one client by closing the tab or disabling network temporarily
3. Confirm the remaining client sees the disconnect/presence update
4. Reconnect the disconnected client within the allowed grace period
5. Confirm the client returns to the correct room and state if supported
6. Repeat after the grace period and confirm the old session is not incorrectly restored

## Milestone outcome
The game feels like a real multiplayer room, not just a shared board.

### Phase acceptance
- Open at least two clients in one room and exchange chat messages
- Confirm messages stay room-scoped and disappear when the room closes
- Simulate a disconnect and reconnect and confirm presence updates behave correctly

---

# Phase 7 — Multi-round matches and final results

## Goal
Connect rounds into complete matches.

## Subphase 7.1 — Match progression
Implement:
- round counter
- transition from one round to the next
- round summary hold state with host continue action
- automatic next-round advance after the summary timeout
- match-end detection based on configured round count

### Deliverable
- rooms can play a full configured match

### Testable actions
#### Automated verification
- Test round counter increments correctly
- Test host continue action advances from summary to the next round
- Test summary auto-advance happens after the configured timeout
- Test match ends after configured round count
- Test next-round state resets only what should be reset

#### Manual verification
1. Start a match with a small number of rounds such as 2 or 3
2. Finish round 1
3. Confirm the round summary appears
4. Use the host continue action and confirm the next round starts immediately
5. Finish another round and do not continue manually
6. Confirm the next round starts automatically after the summary timeout
7. Finish all configured rounds
8. Confirm the match ends exactly when expected


## Subphase 7.2 — Match result views
Implement:
- round summary screen
- cumulative scoreboard for PVP
- rounds won summary for co-op
- final winner/team result view
- final results as an in-room state instead of a separate route

### Deliverable
- players can see full match results and outcome

### Testable actions
#### Automated verification
- Test final result payload includes cumulative PVP scores or Co-op round results
- Test result screen renders the correct mode-specific summary
- Test the room state transitions into final results without requiring a separate route

#### Manual verification
1. Complete a full PVP match
2. Confirm the final scoreboard totals are correct
3. Confirm the final results appear inside the room flow
4. Complete a full Co-op match
5. Confirm the final summary shows rounds won/lost instead of points
6. Refresh the room view if refresh support exists and confirm the final state remains stable


## Subphase 7.3 — Replay / rematch flow
Implement:
- rematch request
- host restart or vote flow
- room reset while keeping players together

### Deliverable
- a full loop from match end back to lobby or next match

### Testable actions
#### Automated verification
- Test rematch resets match state while retaining room membership if intended
- Test rematch does not keep stale round data
- Test host-only rematch actions if applicable

#### Manual verification
1. Finish a match with multiple players
2. Trigger rematch flow
3. Confirm the room remains together if that is the design
4. Confirm scores, attempts, round history, and word state reset appropriately
5. Start the new match and confirm it behaves like a fresh session

## Milestone outcome
The game supports full sessions, not just isolated rounds.

### Phase acceptance
- Play a complete multi-round match from start to final results
- Confirm round progression, final summaries, and rematch flow work correctly
- Confirm state is reset correctly between matches when rematch is used

---

# Phase 8 — Persistence, administration, and word management

## Goal
Add durable data and maintainability tools.

## Subphase 8.1 — Persist historical results
Store optionally:
- room match history
- per-player results
- timestamps
- mode and settings used

### Deliverable
- historical reporting data is saved in PostgreSQL

### Testable actions
#### Automated verification
- Test match result rows are inserted correctly
- Test player result rows are inserted correctly
- Test stored mode/settings values match the finished match

#### Manual verification
1. Complete a match
2. Inspect the database tables for stored match history
3. Confirm scores, mode, timestamps, and round counts match the played session
4. Repeat for both PVP and Co-op if both are persisted


## Subphase 8.2 — Word dataset management
Implement:
- import scripts
- activation/deactivation of words
- filtering by length / difficulty / language if needed

### Deliverable
- controlled and maintainable word bank

### Testable actions
#### Automated verification
- Test word import scripts insert expected rows
- Test inactive words are excluded from gameplay
- Test length/difficulty/language filters if implemented

#### Manual verification
1. Import or add a small custom word batch
2. Confirm the new words appear in the database
3. Disable one word
4. Run multiple word selections and confirm the disabled word is not chosen
5. If filtering exists, verify the selected words honor the chosen filters


## Subphase 8.3 — Admin support tools
Possible features:
- inspect rooms
- inspect active matches
- moderate or disable problematic words

### Deliverable
- basic operational visibility for maintaining the game

### Testable actions
#### Automated verification
- Test admin inspection endpoints/pages return the expected data
- Test admin-only restrictions if access control exists

#### Manual verification
1. Open the admin tool or endpoint
2. Confirm active rooms or word management data is visible
3. Perform a safe admin action such as disabling a word
4. Confirm the change is reflected in the database and application behavior

## Milestone outcome
The game is easier to operate, maintain, and evolve.

### Phase acceptance
- Complete at least one match and confirm the expected historical data is stored
- Update the word dataset and confirm gameplay uses the updated data correctly
- If admin tools exist, perform one safe admin action and verify the effect

---

# Phase 9 — Quality, security, and production readiness

## Goal
Make the product stable enough for public use.

## Subphase 9.1 — Automated testing
Add tests for:
- guess evaluation
- PVP scoring
- co-op attempt logic
- room lifecycle
- socket events

### Deliverable
- automated confidence in critical systems

### Testable actions
#### Automated verification
- Ensure unit, integration, and critical end-to-end tests run in CI
- Ensure guess evaluation, scoring, room lifecycle, and chat flows are covered

#### Manual verification
1. Run the full automated test suite locally
2. Intentionally break one covered rule temporarily
3. Confirm the relevant test fails
4. Restore the code and confirm the test passes again


## Subphase 9.2 — Validation and abuse prevention
Add:
- input validation
- rate limiting
- room join constraints
- chat message limits
- guess spam prevention

### Deliverable
- safer public multiplayer behavior

### Testable actions
#### Automated verification
- Test malformed payloads are rejected
- Test rate limiting blocks spammy requests/messages if implemented
- Test unauthorized host-only actions are rejected

#### Manual verification
1. Attempt to send invalid room settings or malformed guesses
2. Confirm the backend rejects them safely
3. Rapidly send repeated chat messages or guesses
4. Confirm rate limits or spam protections apply if enabled
5. Attempt a host-only action as a non-host and confirm rejection


## Subphase 9.3 — Performance and scaling
Add / verify:
- Redis-backed room state
- websocket scaling strategy
- cleanup jobs
- production logging

### Deliverable
- app can support more simultaneous rooms and users

### Testable actions
#### Automated verification
- Run load tests against room creation, chat, and guess submission
- Verify Redis-backed shared state works with multiple backend instances if scaling is implemented

#### Manual verification
1. Open several clients across one or more rooms
2. Send guesses and chat messages quickly
3. Confirm the UI remains responsive and synchronized
4. If multiple backend instances are used, confirm clients on different instances still stay in sync
5. Monitor logs for dropped events or state mismatch warnings


## Subphase 9.4 — Deployment and observability
Set up:
- frontend hosting
- backend hosting
- PostgreSQL
- Redis
- environment secrets
- logs and monitoring

### Deliverable
- production deployment pipeline

### Testable actions
#### Automated verification
- Confirm production build artifacts are generated successfully
- Confirm migrations run successfully in the target environment
- Confirm health checks pass after deployment

#### Manual verification
1. Deploy the frontend and backend to the chosen environment
2. Verify environment variables are configured correctly
3. Verify the health endpoint is reachable
4. Open the deployed frontend and create a room
5. Join from another browser/device
6. Play at least one short round and send chat messages
7. Confirm logs and monitoring tools capture activity and errors as expected


## Milestone outcome
A production-capable version of the game is ready.

### Phase acceptance
- Run the automated test suite and confirm critical flows are covered and passing
- Verify validation, abuse-prevention, and scaling checks behave as expected
- Perform a deployed smoke test with at least two clients and confirm monitoring/logging is visible

---

## 7. MVP recommendation

If the goal is to get the first real playable version quickly, the MVP should end at:
- **Phase 1** complete
- **Phase 2** complete
- **Phase 3** complete
- **Phase 4** complete
- **Phase 6.1 and 6.2** complete
- **Phase 7.1 and 7.2** complete

That MVP includes:
- room creation and joining
- PVP multiplayer
- optional round timer
- configurable auto-send or manual-submit guesses
- scoring and leaderboard
- room chat
- multiple rounds
- final results

Then add **Co-op mode** as the next milestone if you want to reduce initial complexity.

If both modes are essential from the beginning, then include **Phase 5** in the MVP.

---

## 8. Suggested milestone breakdown

### Milestone 1 — Foundation
Phases:
- Phase 0
- Phase 1

### Milestone 2 — Core gameplay engine
Phases:
- Phase 2

### Milestone 3 — Multiplayer lobby
Phases:
- Phase 3

### Milestone 4 — PVP playable end-to-end
Phases:
- Phase 4

### Milestone 5 — Co-op playable end-to-end
Phases:
- Phase 5

### Milestone 6 — Chat and resilience
Phases:
- Phase 6

### Milestone 7 — Full match flow
Phases:
- Phase 7

### Milestone 8 — Persistence and operations
Phases:
- Phase 8
- Phase 9

---

## 9. Final architecture recommendation

### Preferred stack for your requirements
- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend:** NestJS + Socket.IO + TypeScript
- **Database:** PostgreSQL
- **Ephemeral state / chat / timers:** Redis
- **SQL access:** **Slonik** with hand-written SQL and SQL migrations

This stack matches:
- real-time multiplayer needs
- your raw SQL preference
- room-based ephemeral chat
- flexible support for both PVP and co-op modes
- your decision to test a SQL-first client instead of an ORM

---

## 10. Manual installation checklist

These are the manual installations that may be needed for local development, especially if you do not use Docker for everything.

### Required
- **Node.js LTS**
  - recommended: Node 20 LTS or newer compatible LTS release
  - includes `npm`
- **A package manager**
  - `pnpm` recommended, but `npm` is acceptable
- **PostgreSQL**
  - recommended: PostgreSQL 16+
- **Redis**
  - recommended: Redis 7+
- **Git**

### Recommended
- **Docker Desktop**
  - useful if you want PostgreSQL and Redis locally without manual service setup
- **A database GUI**
  - examples: DBeaver, Beekeeper Studio, pgAdmin
- **A Redis GUI or CLI familiarity**
  - optional, but useful for inspecting room/chat ephemeral data

### Backend packages to install in the server app
Core expected packages for the database layer:
- `slonik`
- `postgres` is **not** required if Slonik is the chosen client
- one migration tool, preferably:
  - `dbmate`, or
  - your own SQL migration runner

Other likely backend packages:
- `socket.io`
- `ioredis` or `redis`
- `zod` for validation if desired

### Manual setup notes
- Make sure PostgreSQL is running and that you have created a database for the project
- Make sure Redis is running before testing room state, timers, and chat
- Store connection strings in environment variables
- Ensure the PostgreSQL and Redis ports are not blocked or already in use
- If installing manually on Windows, verify the installed binaries are available in `PATH` when needed

### Example environment variables
- `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/guess_the_word`
- `REDIS_URL=redis://localhost:6379`
- `PORT=3000`
- `CLIENT_URL=http://localhost:5173`

### Optional Docker fallback
If local manual installation becomes annoying, use Docker containers for:
- PostgreSQL
- Redis

That keeps the app stack consistent across machines while still using Slonik and raw SQL in the codebase.
