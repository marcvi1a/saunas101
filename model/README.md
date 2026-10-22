# The ventilation model

The score of every switch state on /ventilation comes from here. Nothing in it is hand-set: every number is a physical constant, a measurement of the drawing, a cited value or derived from those, and each derivation with its sources and confidence is in docs/.

| file | what it does | derivation |
|---|---|---|
| airflow.js | pressure balance of the room: every opening, the stratified room air, bare ducts cooling outdoors, the door gaps, the fan on its curve, reversed flows | docs/airflow.md |
| feet.js | the room's temperature from floor to ceiling, and the feet factor from the ASHRAE 55 local-discomfort models | docs/feet.md |
| breathing.js | the heater's plume and the inlet's jet: how much fresh air reaches the upper bather's mouth, and the CO₂ there | docs/breathing.md |
| score.js | breathing from CO₂ at the mouth along Fanger's dissatisfied curve: full at EN 16798-1 Category I, zero at the CO₂ of a sealed room with the same heater; times feet | docs/score.md |
| evaluate.js | joins them, with the page's two settings: a 2 mm gap under the door and the air judged at steady state | |
| invariants.js | physical checks over every state; build.js stops if a hard one fails. `node invariants.js --self-test` proves it catches broken models | docs/validation.md |
| check/routes.js | runs every state through breathing.routes(), the per-stream routing the drawing follows, and checks that it adds up and matches the flows; build.js runs it with the invariants | docs/breathing.md |
| check/airflow-b.js, check/compare.js | an independently built airflow network, and a script comparing the two over every state | docs/airflow-b.md |

build.js runs the model when any file here changes, checks the invariants and the routes, scales the scores from a sealed room (0) to the model's best state (100), and writes scores.js with each state's score and the air the drawing shows. docs/brief.md is the brief the five parts were built from.
