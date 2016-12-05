# Combinators
## InjectSources
## SwitchForEach
## SwitchCase
## List
- all items will emit sinks
- all item components should be passed an id in settings
## Router
## StateChart (EHFSM)
- example
```
StateChart({
  intents : Hash{intentIdentifier :: sources -> settings -> source},
  actionResponses : [SinkIdentifier] - must match sinks returned by action,
  action : State a-> State b -> State err -> Event -> Guard -> Action
    where Action :: event -> model -> sinks
})
```
- internal state : requestTokens: {[sinkName] : token}
  - every command request must be associated to a token if an answer is 
  expected
  - when the sink emits a value, its token is compared to the request
- model is a property, hence one must specify an initial value
- action requests need to have a namespace parameter, and a get method which 
takes a namespace as parameter
- namespace chosen for statechart must be unique vs. action request drivers
- when an action is requested, no other events is processed, and only on 
receiving the expected action response, the state is changed : RTC semantics
  - when namespace is unique, and RTC, it is guaranteed that the next 
  response will correspond to the previous request

Drivers for action must be wrapped into a higher-order function which will 
add a unique token serving to identify the request. The response will only be
 accepted as matching a request if both have the same token.   
## m

# Driver
## Store Driver - for now likely key/value store

# Sinks combinators
## Merge
- {method: concat} is one possibly of specifying a merge function
- could also be {method : a function} to cover the general case

# Examples
## TODO list app
### Functional specifications
- three routes : active todos, completed todos, all todos
- one field `what needs to be done?` to enter new todo
- list of entered todos
- for each entered todos, delete button, completed radio, text input with 
todo description
- one label with `x` items left
- three labels `All`, `Active`, `Completed` being emphasized according to route
- authentication required to view active or all route
- no authentication required to view completed route
### Technical specifications
#### Data structures
TodoList :: [TodoItem]
TodoItem :: {active : Boolean, description : String}
AppState :: TodoList
#### Drivers
- auth$ : returns true or false if the user is logged in or not respectively
- route$ : navigates to a given route, emit new route events
- DOM
- Store
#### Constants and properties
- IS_LOGGED_IN
- ALL
- ACTIVE
- COMPLETED
#### Components
- LogIn : display a dummy message, one button which logs in and reroutes
### Implementation through combinators
const sinks = [TODO]
App({sinks : sinks}, [
  OnRoute('/', SwitchCase({
      on : 'auth$'
    }, [
      Case({when: IS_LOGGED_IN}, [
        TodoComponent({routeState : ALL}) // actually will require flip or 
        // curry and R.__
      ]),
      Case({when: complement(IS_LOGGED_IN}, [
        LogIn({redirect: '/'})
      ])
    ]
  )),
  OnRoute('/active', SwitchCase({
      on : 'auth$', sinks : sinks
    }, [
      Case({when: IS_LOGGED_IN}, [
        TodoComponent({routeState : ACTIVE}) // actually will require flip or 
        // curry and R.__
      ]),
      Case({when: complement(IS_LOGGED_IN}, [
        LogIn({redirect: '/active'})
      ])
    ]
  )),
  OnRoute('/completed', TodoComponent({routeState: COMPLETED})
  )
])
TodoComponent=curry(flip(
  StateChart({
    sinks : [sinkNames],
    namespace : some UNIQUE (vs. action requests) identifier for the statechart, // Ex: TODO_SC
    intents : {ADD_ITEM, COMPLETE_ALL},
    actions : [ADD_ITEM, COMPLETE_ALL],
    responses : {ADD_TODO : response => ...}
  },
  model$ : {Store.get(namespace, null), showOnlyActive : settings.routeState},
  transitions : [
    INIT -> SUCCESS:INIT -> ERROR: ?? -> NO GUARD -> ADD_ITEM : 
      (event, model$) => Merge({method: concat}, [
        {Store: $.of({command: ADD_TODO, namespace, payload: todoText})},
        SwitchForEach(model$, List (prepare(model), TodoItemComponent))
      ]),
    INIT -> SUCCESS:INIT -> ERROR: ?? -> NO GUARD -> COMPLETE_ALL :
      (event, model$) => {Store: model$.map(childIndex => {
        reference: childRef(childIndex, parentRef),
        command: UPDATE, 
        payload: refValue => setCompleted(refValue)
        // setCompleted = refValue => (refValue.completed = true, refValue)
      })},
    ADD_ITEM_ERROR -> ??? -> ERROR: ?? -> NO_GUARD -> AUTO :
      // could do multiple retry through this mechanism
  ],
  })
))
TodoItemComponent = 

- Parent hold reactive COPY (i.e. property) of the state of their children
  - Store.get(namespace, reference)
    - reference is the root level so all children changes are propagated
    - similar to firebase (CHECK)
- ADD CHILD event : 
  - modify parent state to add a new childState to [childState]
    - SUCCESS : recompute sources = f (sources, parentState$)
      - parentState has [childState]
      - List({initChildStates, parentScope}, Item)
    - FAILURE : TO DO
- On STORE CHANGE event:
  - get the index of child(ren) who has/have changed
  - if the change is a deletion, recompute sources
  - else do nothing
  - hence communication children -> parent is coordinated through STORE
    - communication parent -> children is done through updating children 
    settings. This involves recomputing the children - or using an observable
     passed through settings

- Child has a DELETE event
  - associated action is to update child state to null
  - 

- Store has following behaviour
  - takes listener for changes
  - listener can listen for changes on a specific path
  - changes happening at a specific path are also emitted to listener at a 
  higher level
    - in that case, the reference(s) of the changes are also sent
  - similar to firebase
  - hence event change is both a property (new current state) and an event
  (state change)... 
    - Is it sound to conflate the two?? Be careful to multicast by default in
     that case : will have subscription for property + subscription for event
