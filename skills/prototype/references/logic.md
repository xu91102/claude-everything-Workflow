# Logic Prototype

Build a tiny interactive terminal app for business logic, state transitions or data-shape questions.

## Shape

1. Isolate the logic behind a small pure interface:
   - reducer `(state, action) -> state`;
   - explicit state machine;
   - pure transformations over plain data;
   - stateful module only when ongoing internal state is the question.
2. Keep terminal I/O in a thin shell. The logic module must not print, prompt or depend on terminal
   escape codes.
3. Render one stable frame after every action:
   - full current state;
   - legal actions and one-key/one-line controls;
   - quit action.
4. Keep the whole frame visible on one screen.
5. Add one run command using the existing package manager or task runner.

## Boundaries

- Do not add tests to the prototype.
- Do not use the production database unless persistence is the explicit question; then use a clearly
  disposable scratch store.
- Do not generalize beyond the one stated question.
- The TUI shell never ships. A validated pure model may inform production code, which must be rewritten
  through the normal implementation workflow.
