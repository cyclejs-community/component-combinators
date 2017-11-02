# Infinite scrolling component
- input 
  - host element
- algorithm
  - scrolling element <- host element
  - when scrolling element reaches down 
    - compute the visible items to show
  - display <-= visible items 
  
# New cycle
- sources, settings with sources :: {observables/observable factory, iterators/iterator factory?}
  - observable for the push mechanism
  - iterators for the pull mechanism
  - in all cases, effects are hidden behind iterators, or in driver
    - iterator.next(), or iterator.next(arguments)
      - so iterator is similar to a sink, but not push this time
    - QUESTION : would the function still be pure
      - it was not pure to start with anyways
      - but f(observables, iterators, settings) could be pure
      - but if we inject effect handlers as iterators, it means we can also have those effect handlers return promises, so we have async iterable covered. What we don't have is intantenaous propagation of changes between behaviours
      - so with iterators as effect handlers we do not need anymore drivers like HTTP, or any request/answer driver. All of them can be taken care of by the effect handler.
    - we are left with the issues of maintaining reactive equations
      - z = x + y. which implies propagating changes of x and y (atomically if possible)
        - t = seconds + 1, g = (t > seconds) should be without glitch

# New paradigm
- in the end what we end up having is 
  - a sytem of equation defining behaviours, and which always hold
  - a reactive system (action, state update before, state update after)= f(events) where 
    - events trigger actions
    - those actions trigger up state update, by which behaviours which depend on these states are updated

Example : input word + label translation + button `fetch`, where button `fetch` returns the translation of the input word.

Update mechanism
- behaviour
  - set : only way to IMPERATIVELY propagate changes
    - only for ImperativelyUpdatedBehaviour(initial value, ...)
    - i.e. similar to subjects for events
  - get : return current value
    - make use of cache and cache invalidation and dependencies, not to compute uselessly values
  - dependencies : array of dependencies (could also be tree for topologic search)
  - UpdatableBehaviour.toBehaviour() -> to hide the `set` API (similar to subjects)
- event
  - event name
  - observable (stream of events)
  - consumers (for multicast)
- behaviour to event :: Behaviour(s) -> Event
  - share : Behaviour -> Event
    - returns the behaviour change event. 
    - option to distinguish between actual change of the underlying value or not (distinctUntilChanged)
    - combineLatest : Behaviours -> Event
  - behaviour.sample(event) : Behaviour -> Event -> Event
    - returns an event whose event data is the value of the behaviour at the time of the event
- behaviour to behaviour : Behaviour(s) -> Behaviour
  - map : Behaviour -> Behaviour
  - combine : Behaviours -> Behaviour
- event to behaviour : Event(s) -> Behaviour
  - shareReplay(1) with initial value : Init -> Event -> Behaviour
  - if several events reduce them to one event with a Events -> Event function
    - that is what is actually done on combineLatest, each event is produced, then the events are merged into one
    - it is always possible because the only operations we can do on Event ends up being Event
- event to event
  - standard stream operators

Repeating

Behaviours :
- input_word = B.fromDOM(document) = (document) -> document.querySelector...get
- view_state = mapB(identity, fetched_translation)
- fetched_translation = ImperativelyUpdatedBehaviour("", fetch_word, fetch*)
- DOM_view = view_state -> button_click -> VTree 
- displayed = ImperativelyUpdatedBehaviour(null, rAF, render*)
 
Events :
- button_click = new subject(), name 'fetch button click'
- fetch_word = sample(button_click, input_word)
- rAF = observable.create() - fromSystem(rAF)

Effect handler :
- are generators
- all handlers have access to all behaviours (that is the state of the system!!) AND triggering event
  - for instance, fetch*(behaviours, button_click)
  - fetch* :: Generator
  - render* :: Generator
    - called as next(VTree) and displays a DOM and returns done (finished)

Application :
- holds
  - event factories
  - effect handlers
  - behaviour definitions i.e. behaviour factories
- run
  - execute event factories
    - they should all be executable without errors
  - execute behavior factories
  - actually could go without factories, just the direct equations, but factories are better to pass up names for each entity and allow for tracing
    - because all events are shared, and all behaviours are replayed, I can trace without disturbing side-effects
  - should be all, events are set up and will trigger action, and behavior will update automatically 


Events | Actions
- click button `fetch` | [update fetched_translation to 'pending', fetch translation, update fetched_translation to result if successful, to 'not found' if not]
  - fetch will be a coroutine, will receive values, perform effects and return values
- rAF | [update DOM with DOM_view]

- Beware the same event can be associated to several actions (share!) -> make it an array? or do the graph prior? BY DEFAULT ALL ARE SHARED
- API
  - ImperativelyUpdatableBehaviour :: Init -> Event -> ActionGenerator -> Behaviour
    - coroutine mechanism 
      - when event triggers, execute action generator, get action iterator
      - consume the iterator (for...of)
        - for each value, imperatively update the behaviour
        - that value can be a promise, and in general is a promise!
        - next() means execute the action
        - the promise when resolved/rejected is associated to different state update
   - easy to mock, change the ActionGenerator not to realize the effects


Application loop
- every action frame, compute DOM_view
  - DOM_view.get
    - view_state.get
      - fetched_translation.get
        - if not done yet
          - subscribe to button click, and set the generator loop on it
        - get the value stored
  - possible problem is that the button click must exist, so the DOM view must have been set first...
    - so for instance, the EVERY... must render initial state where the button prior to initializing the event listener
      - so basically we have temporal dependency between  
      - for now, if error when installing the event, do nothing. At the next frame we will try again.
        - but when to remove event listener...
        - but that does not solve the general problem though or does it? If the event cannot be computed then do nothing basically. or ERROR?
- have a destroy mechanism - linked to mutationObserver on the element. So that behaviour can release resources ?? (like listeners)
  - to think about, if there is destroy, there is create. So conceptualize better the lifetime for behaviour and events
  - add a when :: behaviour -> behaviour -> Behaviour to switch between behaviour and we destroy the switched off behaviour?? need specific operator for lifetime?

Application shell
- holds all behaviour, actions, events etc. for the application
- allow to create behaviours and other objects
- has a run method, which creates/activates all events and other objects

