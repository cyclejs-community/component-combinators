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
- internal state : {status: pending action|ready}
- exposed state : {state, model}
- model is a property, hence one must specify an initial value
- action requests need to have a namespace parameter, and a get method which 
takes a namespace as parameter
- cannot have two pending action requests on the same namespace
  - this is ensured by having action requests made by namespaced statecharts
  - ...also by having other components using other namespaces for their commands
  - SO : namespace chosen for statechart MUST be unique vs. other statecharts 
 and ANY other action requests 
- when an action is requested, no other events is processed, and only on 
receiving the expected action response, the state is changed : RTC semantics
  - when namespace is unique, and RTC, it is guaranteed that the next 
  response will correspond to the previous request
  - internal model update for the FSM MUST be synchronous and MUST never fail
- action requests : 
  - driver name
  - {namespace, ref, command, payload}
- action responses :
  - driver name same as action requests
  - .getResponses(namespace)(reference)
- driver with a current value IMPLEMENTS ReactiveStore interface:
  - driver name
  - get(namespace)(reference)
- driver without a current value (i.e. events) IMPLEMENTS Observable interface:
  - driver name
  - subscribe(observer)
- has entry actions executed on a CHANGE of state (non-trivial transition) 
and ENTRY of that state, i.e. after completion of a triggered action or INIT
  - entry actions MUST NOT fail

## m

# Driver
## Store Driver - for now likely key/value store

# Sinks combinators
## Merge
- {method: concat} is one possibly of specifying a merge function
- could also be {method : a function} to cover the general case

