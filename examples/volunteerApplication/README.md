# Motivation
This is a demonstration illustrating the use of a FSM combinator component to display sequence of screens according to a declarative control flow logic and evolving states. It is inspired from a real project (totalling ~20K lines of javascript).

# Specifications
Without going too much in textual details, we reproduce here the initial wireframes from the UX 
team :

![sequence](https://camo.githubusercontent.com/d64fd08f45bd5c28e5cd237ef095f5181c89ea72/687474703a2f2f692e696d6775722e636f6d2f42466a6667575a2e706e67)

From the previous chart, after discussion with the development team, more detailed specifications 
were achieved and the corresponding control flow was derived :

![complete control flow](https://i.imgur.com/dkbSwEw.png)

# Implementation
Note how the following additional concerns have been added to the main flow defined in the 
initial low-fi wireframes, to build a usable and robust volunteer application process :

- incremental application update
  - at each key step of the application process, the filled-in data are stored remotely
- incremental application process
  - user can continue the application process where he left it
- form validation

# Benefits
- Having expressed the application process as a state machine allowed us to reveal transitions 
between states we might otherwise have forgotten, by focusing on the main flow
- only the transitions specified can ever be taken which makes the application process more robust
- incremental design and development is facilitated by our design
  - the error flows were easily added in a second phase, with little or no modification to the 
  core flow already written
- we have a more maintainable codebase
  - we could isolate, trace and correct bugs in the implementation relatively easily because at 
  every step, we know what will happen in response to what, and that is described by small functions, with a single 
  concern.
  
The alternative, which is to keep track of a state variable, and work with a lower level control 
flow mechanism (i.e. if/then/else), is much harder to understand and maintain.
 
# Demo
The previously presented control flow was implemented with the FSM combinator :

![demo](assets/images/animated_demo.gif)

# Component documentation
[Extended Finite State Machine](http://brucou.github.io/projects/component-combinators/efsm/)

# Running it
- `npm install`
- `npm run wbuild`
- have a look at `src/index.js` and decide whether to reset local storage or not at every page load
  - should be done only when local storage is somehow corrupted (can happen between different 
  windows). By default leave the `localForage.clear()` line commented out
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/volunteerApplication` directory 
