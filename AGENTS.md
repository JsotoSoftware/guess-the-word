# Repository agent rules

## Runtime process cleanup
- If you start a local server, watcher, dev process, or anything that opens a port for verification, stop it before finishing your turn.
- Do not leave local processes running in the background after testing.
- After verifying a service, release the port so the user can start the app manually.
- If possible, mention which port was used and confirm that it was freed.
