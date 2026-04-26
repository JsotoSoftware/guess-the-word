# Guess the Word — Game Rules

_Status: Phase 0.1 approved._

## 1. Purpose
This document defines the gameplay and room rules for the multiplayer word game.
It is intended to freeze the rules before Phase 1 begins.

The game supports two modes:
- **PVP**: players guess independently against the same word
- **Co-op**: players guess together against the same word with shared attempts

---

## 2. Shared game rules

### 2.1 Round basics
- Each round has exactly **one secret word** chosen by the server.
- All players in the same room play against the **same secret word** for that round.
- The secret word is never shown during active play.
- Players only see the number of letter boxes matching the secret word length.
- Players enter guesses directly into the visible letter boxes.
- There is no separate free-text guess field outside the letter boxes.

### 2.2 Valid guess rules
Players are allowed to type whatever they want as a guess.
The game does **not** require guesses to exist in a dictionary.

A guess is accepted only if:
- it has the same length as the secret word
- it is submitted while the round is still active

This means:
- players may submit any letter sequence of the correct length
- the frontend may do basic input validation for user experience
- the backend still performs the final validation for length and round state
- a guess is not rejected just because it is uncommon, misspelled, or not a real word

If a guess is invalid:
- it is rejected by the server
- it does **not** consume an attempt
- it does **not** change round state
- the player should receive a clear validation message, for example: `Invalid guess length` or `Round already finished`

### 2.3 Guess submission behavior
Guess entry and guess submission are different actions.

- players always fill the letter boxes from left to right to compose a guess
- a room setting controls whether a completed row is sent automatically
- if **auto-send** is enabled, a guess is submitted as soon as the current row is fully filled
- if **auto-send** is disabled, a guess is submitted only when the player presses the submit action
- the same submission rule applies to the whole room for that match
- the selected submission behavior can be used in both PVP and Co-op
- in Co-op, disabling auto-send is especially useful to avoid accidental consumption of shared attempts

### 2.4 Letter feedback rules
Each accepted guess returns per-letter feedback:
- **Green**: correct letter in the correct position
- **Yellow**: correct letter in the wrong position
- **Red**: letter is not in the word

### 2.5 Repeated letter handling
Repeated letters must be evaluated server-side using count-aware logic.
This means:
- green matches are assigned first
- remaining unmatched letters can become yellow only if the secret word still has unused occurrences of that letter
- extra repeated letters beyond the secret word count are marked red

This rule applies in both PVP and Co-op.

### 2.6 Server authority
The server is authoritative for:
- secret word selection
- guess validation
- letter feedback calculation
- attempt consumption
- round end detection
- scoring
- finish order

Clients only render state and submit actions.

---

## 3. Room rules

### 3.1 Room configuration
A room can be configured with:
- game mode: `pvp` or `coop`
- number of rounds
- attempts per round
- optional PVP timer duration per round
- guess submission mode: `auto-send on row completion` or `manual submit`
- optional max players

Timer rule by mode:
- in **PVP**, the room may be configured with a timer or with no timer
- in **Co-op**, there is no timer

Guess submission rule by mode:
- in **PVP**, the room may use either auto-send or manual submit
- in **Co-op**, the room may use either auto-send or manual submit
- the selected submission rule applies to all players in the room for that match

### 3.2 Room lifecycle
Room states:
- `lobby`
- `in_game`
- `match_finished`
- `closed`

### 3.3 Minimum players to start
- in **PVP**, the room requires at least **2 players** before the host can start the match
- in **Co-op**, the room can start with **1 player** or more
- the UI should clearly indicate whether the room currently has enough players to start

### 3.4 Room chat
- Chat is scoped to the room only.
- Chat messages are visible only to players in that room.
- Chat is available in both the lobby and the in-game experience.
- Chat is ephemeral.
- When the room closes, the chat history is deleted.

---

## 4. PVP rules

### 4.1 PVP round lifecycle
1. Players join the room lobby.
2. The host starts the match.
3. The server selects one secret word for the round.
4. All players enter the round at the same time.
5. Each player receives their own attempt counter.
6. If the room has a timer configured, the round timer starts.
7. Players submit guesses independently.
8. A player finishes when either:
   - they guess the word correctly, or
   - they run out of attempts, or
   - the timer expires, if a timer is enabled
9. The round ends when either:
   - all players are finished, or
   - the timer expires, if a timer is enabled
10. The server reveals the secret word and sends the round summary.
11. The next round starts until all configured rounds are completed.

### 4.2 Attempts in PVP
- Each player has their **own** attempt pool.
- One accepted incorrect guess consumes **one** attempt from that player only.
- One player's guesses never consume another player's attempts.
- Once a player has guessed correctly, that player cannot submit more guesses for the round.
- Once a player has no attempts left, that player cannot submit more guesses for the round.

### 4.3 Timer behavior in PVP
- A PVP round timer is **optional** and depends on room configuration.
- If a timer is configured, it is shared by the whole room.
- If a timer is configured, it starts when the round starts.
- The timer does not pause for disconnects.
- If the timer reaches zero, the round ends immediately.
- Guesses submitted after timer expiration are rejected.
- If no timer is configured, the round ends only when all players are finished.

### 4.4 Scoring in PVP
Players receive points only if they guess the word correctly before the round ends.

Scoring formula:
- correct answer: **base points**
- first correct player: **base points + first-place bonus**
- second correct player: **base points + second-place bonus**
- third correct player: **base points + third-place bonus**
- fourth or later correct player: **base points only**
- incorrect / timed out when a timer exists / no attempts left without success: **0 points**

### 4.5 Finish order in PVP
- Finish order is determined by the **server receive order** of the first accepted correct guess.
- Client-side timestamps are not used for ranking.
- If two correct guesses arrive very close together, the server processing order decides placement.
- Once a placement is assigned, it does not change.

### 4.6 Duplicate guesses in PVP
**Proposed default rule for review:**
- If a player submits the exact same guess they already submitted in the same round, the server rejects it.
- A rejected duplicate guess does **not** consume an attempt.

This is recommended to avoid accidental waste and reduce frustration.

---

## 5. Co-op rules

### 5.1 Co-op round lifecycle
1. Players join the room lobby.
2. The host starts the match.
3. The server selects one secret word for the round.
4. All players enter the same shared round.
5. The room receives one shared attempt pool.
6. Any player in the room may submit a guess.
7. All accepted guesses update the same shared round history.
8. The round ends when either:
   - the room guesses the word correctly, or
   - the shared attempts reach zero
9. The server reveals the secret word and sends the round summary.
10. The next round starts until all configured rounds are completed.

### 5.2 Attempts in Co-op
- The entire room shares one attempt pool.
- One accepted incorrect guess consumes **one** shared attempt.
- All players see the same guess history and remaining attempts.
- Once the room guesses correctly, no more guesses are accepted for that round.
- Once shared attempts reach zero, the round is lost and no more guesses are accepted.

### 5.3 Timer behavior in Co-op
- Co-op rounds have **no timer**.
- Players may take as long as they want.
- Disconnects do not pause or end the round.

### 5.4 Scoring in Co-op
- Co-op mode has **no point system**.
- The room tracks only round outcomes:
  - round won
  - round lost
- Match summary for Co-op is based on rounds won / rounds lost.

### 5.5 Concurrent submissions in Co-op
Because multiple players can submit guesses at nearly the same time:
- the server processes Co-op guesses in **server receive order**
- round state is updated after each accepted guess
- any guess received after the round has already ended is rejected

### 5.6 Duplicate guesses in Co-op
**Proposed default rule for review:**
- If a guess has already been accepted in the current Co-op round, the same guess cannot be accepted again.
- Rejected duplicate guesses do **not** consume a shared attempt.

This is recommended to avoid wasting shared attempts on accidental repeats.

---

## 6. Match flow

### 6.1 Multi-round structure
- A match consists of the configured number of rounds.
- Each round uses a new secret word.
- After the final round, the match ends and a final summary is shown.

### 6.2 Final results
- **PVP** final results show total points and player ranking.
- **Co-op** final results show rounds won and rounds lost.

---

## 7. Disconnect and reconnect rules

**Recommended default for review:**
- A disconnected player may reconnect to the same room if the room still exists and the reconnect happens within a grace period.
- During disconnect, the match continues.
- In PVP, the player's timer exposure continues normally.
- In Co-op, the room continues normally without pausing.
- If the reconnect window expires, the player is removed from the room state.

**Suggested initial grace period:** `60 seconds`

If the game later supports accounts, reconnect should prefer a stable player/session identifier instead of nickname-only recovery.

---

## 8. Host permissions

### 8.1 Host actions in lobby
The host can:
- change room settings
- start the match if the minimum player requirement for the selected mode is satisfied
- close the room

### 8.2 Host actions after a match
The host can:
- start a rematch
- return the room to lobby if that flow is used
- close the room

### 8.3 Locked settings during gameplay
- Room settings should be locked once a match has started.
- Settings can be changed again only after returning to lobby or creating a new match state.

### 8.4 If the host leaves or disconnects
**Recommended default for review:**
- If the host disconnects temporarily, host ownership is preserved during the reconnect grace period.
- If the host leaves intentionally or the reconnect window expires, host ownership transfers to another remaining player.
- Initial recommendation: transfer host to the longest-present remaining player in the room.

---

## 9. Recommended defaults still needing confirmation
These items should be explicitly approved before implementation begins.

### 9.1 PVP numeric scoring values
The scoring structure is defined, but the exact values are still open.

**Suggested starting values:**
- base points: `100`
- first-place bonus: `50`
- second-place bonus: `25`
- third-place bonus: `10`

### 9.2 Reconnect grace period
**Suggested starting value:** `60 seconds`

### 9.3 Idle room cleanup timeout
**Suggested starting value:** `5 minutes` after the room becomes empty or abandoned

### 9.4 Duplicate guess handling
Recommended:
- reject duplicate guesses in PVP per player
- reject duplicate guesses in Co-op for the whole room
- rejected duplicates consume no attempts

### 9.5 Ready check
Not yet required.

**Suggested starting rule:**
- no ready-check system for MVP
- host starts the match manually

### 9.6 PVP timer configuration
Recommended:
- PVP rooms may choose either a timer-enabled round format or a no-timer round format
- if a timer is configured, the timer rules in section 4.3 apply
- if no timer is configured, PVP rounds end only when all players are finished

### 9.7 Guess submission setting
Confirmed rule:
- the room owner can choose between `auto-send on row completion` and `manual submit`
- the selected setting applies to all players in the room for the whole match
- the default room setting is `auto-send`

### 9.8 Minimum players by mode
Confirmed rule:
- PVP requires at least `2` players to start
- Co-op requires at least `1` player to start

---

## 10. Review checklist for Phase 0.1
- Confirm PVP and Co-op rules do not conflict
- Confirm scoring and finish-order rules are explicit
- Confirm timer rules are explicit, including optional no-timer PVP rooms
- Confirm guess submission rules are explicit, including the room-level auto-send/manual setting
- Confirm invalid guess handling is explicit
- Confirm reconnect/disconnect behavior is explicit or clearly marked as a recommendation pending approval
- Confirm host permissions are explicit
- Confirm minimum player requirements by mode are explicit
