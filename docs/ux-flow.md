# Guess the Word — UX Flow

_Status: Phase 0.2 approved._

## 1. Purpose
This document defines the main user flows, screens, and transitions for the MVP user experience.
It covers both PVP and Co-op modes.

The goal is to make the product flow clear before UI implementation starts.

---

## 2. Primary user journey

Main journey for a player:
1. Open the website
2. Choose to create a room or join a room
3. Enter nickname
4. Enter or review room settings
5. Wait in the lobby
6. Start the match
7. Play through one or more rounds
8. See round summary after each round
9. See final match results
10. Optionally play again or leave

---

## 3. Screen map

```text
Landing page
 ├─ Create room flow
 │   └─ Room lobby
 │       └─ Match start
 │           └─ In-game screen
 │               ├─ Round summary
 │               │   └─ Next round
 │               │       └─ In-game screen
 │               └─ Final results
 │                   ├─ Rematch
 │                   │   └─ Room lobby or new match start
 │                   └─ Leave room
 └─ Join room flow
     └─ Room lobby
         └─ same flow as above
```

---

## 4. Screen definitions

## 4.1 Landing page
### Purpose
Entry point for all players.

### Main actions
- create room
- join room
- optionally read a short description of the game

### Main content
- game title
- short subtitle or explanation
- create room button
- join room input/button

### Transition rules
- selecting **create room** opens the create room flow
- selecting **join room** opens the join room flow

### Notes
- keep this screen simple and fast
- no account system is required for MVP

---

## 4.2 Create room flow
### Purpose
Allow a host to create a room and choose match settings.

### Required inputs
- nickname
- game mode: PVP or Co-op
- number of rounds
- attempts per round
- optional PVP timer setting
- guess submission setting: auto-send or manual submit
- optional max players

### Default values
- guess submission mode defaults to **auto-send**

### Main actions
- confirm room creation
- cancel and go back

### Transition rules
- on success, user becomes host and enters the room lobby
- on cancel, return to landing page

### UX notes
- if PVP is selected, show timer options
- if Co-op is selected, hide or disable timer options
- show the guess submission setting for both modes
- validate required inputs before allowing room creation

---

## 4.3 Join room flow
### Purpose
Allow a player to join an existing room.

### Required inputs
- room code
- nickname

### Main actions
- join room
- cancel and go back

### Transition rules
- on success, player enters the room lobby
- on invalid room code, show clear error
- on full room, show clear error
- on closed room, show clear error
- on cancel, return to landing page

### UX notes
- joining should be quick and low-friction
- nickname conflicts should be handled with a visible error or auto-suggestion strategy later if needed

---

## 4.4 Room lobby
### Purpose
Wait room before gameplay starts and configure the match.

### Visible information
- room code
- player list
- host indicator
- current settings
- selected game mode
- selected guess submission setting
- optional player count / max players
- chat panel
- copy/share room code action

### Host actions
- change room settings
- start match
- close room
- copy/share room code

### Non-host actions
- view settings
- leave room
- use chat
- copy/share room code

### Transition rules
- when host starts the match, all players move to the in-game screen
- in PVP, start is allowed only if at least 2 players are in the room
- in Co-op, start is allowed with 1 player or more
- when a player leaves, lobby updates in real time
- when room closes, all players return to the landing page immediately

### UX notes
- only the host should see editable controls for settings
- settings should clearly show whether the room is PVP or Co-op
- lobby should make it obvious when enough players are present to start
- in PVP with only 1 player present, the start action should appear disabled with an explanation
- in Co-op with 1 player present, the host should still be allowed to start

---

## 4.5 In-game screen
### Purpose
Main gameplay screen for each round.

### Shared content for both modes
- round number
- letter boxes / guess board
- room chat
- player list or match context
- round status messages
- submit action only if the room uses manual submit

### Guess entry behavior
- players enter their guess directly into the visible letter boxes
- the letter boxes are the guess input UI
- there is no separate text input field for writing guesses
- players fill the boxes in order from left to right
- once all boxes are filled, the game follows the submission rule configured for the room
- if the room uses auto-send, a full row submits automatically
- if the room uses manual submit, a submit button is required after the row is complete

### PVP-specific content
- personal attempt counter
- round timer if enabled for the room
- scoreboard / ranking panel
- personal guess history

### PVP-specific guess behavior
- players always fill the current row using the letter boxes
- if the room uses auto-send, the guess is sent immediately when the row is complete
- if the room uses manual submit, the player must press submit after the row is complete
- if the guess is rejected because of invalid length or round state, the UI should show a clear message

### Co-op-specific content
- shared attempt counter
- shared guess history
- no score panel
- clear team-oriented status messaging

### Co-op-specific guess behavior
- players fill the visible letter boxes in order
- if the room uses auto-send, the guess is sent immediately when the row is complete
- if the room uses manual submit, the player must press the submit button to send the guess
- manual submit is especially useful in Co-op because it reduces accidental use of shared attempts

### Transition rules
- after each guess, board updates with feedback colors
- when the round ends, move to round summary
- if room closes unexpectedly, move to room-closed state or landing page

### UX notes
- input should be disabled when the player or room can no longer submit guesses
- PVP and Co-op layouts should feel similar but must clearly distinguish shared vs personal state
- the selected submission mode, auto-send or manual submit, should be visually obvious
- chat should stay visible without covering the main board

---

## 4.6 Round summary screen
### Purpose
Show what happened in the completed round before the next round begins.

### Shared content
- secret word reveal
- round outcome
- next round indicator
- visible countdown until automatic advance

### PVP-specific content
- placements for the round
- points earned this round
- updated cumulative scoreboard

### Co-op-specific content
- round won or lost
- shared attempts outcome
- cumulative rounds won / lost

### Transition rules
- after a round ends, the summary screen appears
- the host can advance to the next round immediately using a continue action
- if the host does not continue, the summary advances automatically after about **60 seconds**
- after the final round, move to final results instead of the next round

### UX notes
- summary should be short and readable
- players should clearly see that the host may continue early
- players should also clearly see the automatic advance countdown

---

## 4.7 Final results screen
### Purpose
Show the complete match outcome.

### Implementation decision
For MVP, final results should be presented as a **state inside the room flow** instead of a separate standalone route.
This keeps the room lifecycle simpler, keeps all players synchronized more easily, and avoids unnecessary routing complexity for a real-time multiplayer experience.

### PVP content
- final player ranking
- total points
- placements if desired

### Co-op content
- rounds won
- rounds lost
- final team result

### Main actions
- rematch
- return to lobby if that flow is supported
- leave room

### Transition rules
- rematch returns the room to a pre-game state or immediately starts a fresh match depending on final implementation
- leave room returns the player to landing page
- if the room is closed, players return to the landing page immediately

### UX notes
- result messaging should make the outcome feel satisfying
- rematch should be easy for groups

---

## 4.8 Error / fallback states
### Recommended fallback screens or dialogs
- invalid room code
- room full
- room closed
- disconnected from server
- reconnecting
- failed to reconnect

### UX notes
- errors should be clear and short
- players should always know their next action
- reconnect states should not feel like a crash screen

---

## 5. Core interaction flows

## 5.1 Host creates a room
1. Host opens landing page
2. Host selects create room
3. Host enters nickname and settings
4. Host confirms creation
5. Host is redirected to lobby
6. Room code is shown for sharing

## 5.2 Player joins a room
1. Player opens landing page
2. Player selects join room
3. Player enters room code and nickname
4. Player submits join request
5. If valid, player enters lobby
6. Lobby updates for all connected users

## 5.3 Match start
1. Host reviews settings
2. The lobby verifies the minimum player requirement for the selected mode
3. Host starts match
4. All players transition to in-game screen
5. Round 1 begins with selected mode rules and the selected submission mode

## 5.4 PVP round flow
1. Players see personal board state
2. Players fill the current row of letter boxes
3. If auto-send is enabled, the guess is sent when the row is complete
4. If manual submit is enabled, the player presses submit after the row is complete
5. Each player receives their own feedback
6. Scoreboard updates as players finish
7. Round ends when everyone is done or timer expires if enabled
8. Round summary appears

## 5.5 Co-op round flow
1. Players see shared board state
2. Any player can fill the current row of letter boxes
3. If auto-send is enabled, the guess is sent when the row is complete
4. If manual submit is enabled, that player presses the submit button after the row is complete
5. Shared board updates for all players
6. Shared attempts decrease on accepted incorrect guesses
7. Round ends on correct guess or zero shared attempts
8. Round summary appears

## 5.6 Match completion
1. Final configured round ends
2. Final results state appears inside the room flow
3. Group chooses rematch or leave

---

## 6. MVP UI structure recommendation

## 6.1 Main routes
Recommended routes for the frontend:
- `/` — landing page
- `/room/:code` — room flow entry containing lobby, in-game, round summary, and final results states

Recommended approach:
- use one room route with internal screen states instead of separate pages for lobby/game/results
- this is the preferred MVP structure for this project

## 6.2 Layout recommendation for desktop
### In-game layout
- center: game board and round controls
- side panel: scoreboard or team info
- side or bottom panel: room chat

## 6.3 Layout recommendation for mobile
- board first
- guess input below board
- collapsible or tabbed chat/score panels
- preserve readability of attempts, timer, and round number

---

## 7. UX differences by mode

## 7.1 PVP clarity requirements
The UI should make it obvious that:
- each player has personal attempts
- placement matters
- score matters
- timer may or may not be active depending on room configuration
- the room may use either auto-send or manual submit
- at least 2 players are required to start the match

## 7.2 Co-op clarity requirements
The UI should make it obvious that:
- attempts are shared
- there is no score ranking
- the team wins or loses rounds together
- there is no timer
- the room may use either auto-send or manual submit
- the match can start with only 1 player if desired

---

## 8. Final UX decisions for MVP
- round summary auto-advance uses a fixed delay of about **60 seconds** for MVP
- the host may continue earlier before the timer ends
- final results use a **full-screen in-room state** instead of a modal overlay
- final results remain part of the room flow and do not use a separate route

---

## 9. Review checklist for Phase 0.2
- Confirm every major screen is represented
- Confirm screen-to-screen transitions are defined
- Confirm host and non-host actions are clear
- Confirm both PVP and Co-op flows are represented
- Confirm timer-optional PVP flow is represented
- Confirm the room-level auto-send/manual submit setting is represented
- Confirm minimum-player-to-start rules are represented
- Confirm round summary advance behavior is represented
- Confirm chat visibility in both lobby and in-game is represented
- Confirm fallback/error states are represented
