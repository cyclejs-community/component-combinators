# Motivation
This is a demonstration illustrating the use of a FSM combinator component to display sequence of screens according to a declarative control flow logic and evolving states.

![sequence](https://camo.githubusercontent.com/d64fd08f45bd5c28e5cd237ef095f5181c89ea72/687474703a2f2f692e696d6775722e636f6d2f42466a6667575a2e706e67)

# Component documentation
[Extended Finite State Machine](../../documentation/EFSM.md)

# Running it
- `npm install`
- `npm run wbuild`
- have a look at `src/index.js` and decide whether to reset local storage or not at every page load
  - should be done only when local storage is somehow corrupted (can happen between different 
  windows). By default leave the `localForage.clear()` line commented out
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/volunteerApplication` directory 
