- bug with sources.source called several times. Use share or shareReplay(1) wisely - tricky to debug
  - in the case of drivers specially think long about using share or shareReplay..., but there should be one, as there is no guarantee a driver source won't be called several times...
- trace every single f.. sink
  - it is relatively easy to see data flow, but when the problem is that the data does not flow it gets hairy, as this is often due to subscription not happening, and there is no way to trace subscription (unsubscription is possible to trace somehow due to `finally`).
  - NOTE : onSubscribe possible. cf. https://stackoverflow.com/questions/41883339/observable-onsubscribe-equivalent-in-rxjs
- in the example aplication, interesting how important to think that Switch is disconnection a component sinks, so here the router never gets to emit a route
- DO NOT FORGET THE SINKS in SINKNAMES
  - adding a sink in `run` but not in settings.sinkNames will lead to hard to trace bugs!!
  - Look if I can issue a warning if a component emits a sink not part of sinknames

# State management
## from button group
// NOTE : Here we present a case of optimistic update for local state. This is fundamented in
// the fact that local state update cannot fail, that is the key difference vs. remotely persisted
// state.
// So: user clicks on a tab from the tab group, that updates the local state for the tab group,
// the ui updates, and then that local state is translated into a state update action for
// the corresponding app level piece of state (i.e. task filter)
// Note again that we have two semantically distinct concepts, which belong to two distinct
// layers :
// - which button of the button group is clicked
//   - that is UI state corresponding to the UI layer
//    - that state is not visible out of the specific portion of the UI it is declared in
// - what is the current filter for the tasks
//   - that is non-persisted local app state corresponding to the domain layer
//   - that is visible by the whole app

# third-party bugs or strangeties
cf. bug tags in the code. How to 

- bug in snabbdom
  - when using keys, weird, dont have the repro anymore
  - when having a #selector after a .selector
- desync. snabbdom vs. actual DOM
  - in case of input for instance (a more elegant solution would be to have an input component??) ALWAYS USE A KEY FOR INPUTS

- firebase
  - cannot set a property to undefined
    - `makeDomainActionDriver: an error occured Error: Firebase.set failed: First argument contains undefined in property 'projects.-KtxLeGQmuU5ViOm8XQO.tasks.4.done'  `
  - cannot set a property to null : it means remove

# containers
- are the constant part of the rendering function
- holes are for the variable part
