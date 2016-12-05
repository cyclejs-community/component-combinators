# Combinators
## InjectSources
## SwitchForEach
## SwitchCase
## List
- all items will emit sinks
- all item components should be passed an id in settings
## Router
## StateChart (EHFSM)
```
StateChart({
  intents : Hash{intentIdentifier :: sources -> settings -> source},
  actionResponses : [SinkIdentifier] - must match sinks returned by action,
  action : State a-> State b -> State err -> Event -> Guard -> Action
    where Action :: event -> model -> sinks
})
```
Drivers for action must be wrapped into a higher-order function which will 
add a unique token serving to identify the request. The response will only be
 accepted as matching a request if both have the same token.   
## m

# Driver
## Store Driver - for now likely key/value store

# Examples
## TODO list app
### Funcional specifications
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
    intents : 
  })
))
