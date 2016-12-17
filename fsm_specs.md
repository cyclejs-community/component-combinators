- Each statechart has states
- All states have one entry action which is to initialize a component.
  That means when the state is entered, the sinks of the component are
passed down to the drivers. This means regular interactive behaviour of
component can occur, but none of those behaviours will lead to a change
of state in the state machine.
- statechart reacts to a set of configured events
- each of those events, if a guard condition is fulfilled, MUST lead to a change of state in the state machine. That condition could be relaxed at a later point. It is there to avoid terminating the current component and re-instantiating it anew. This could become a configuration option (re-enter the state on event triggered, or remain in the state)
- each of those events MUST trigger an action configured in the fsm
- States then have actions which can change the state of the state machine.
Those actions are part of the definition of the state machine. Those actions 
come with :
    - destination driver
    - action description (parameters passed to the destination driver) in the
 form of a function which returns those parameters AND TAKES WHICH INPUTS??
    - token identifying the action request so its response can be listened to
    - success target state - case pending action succeeds
      - fsm model update function
    - error target state - case pending action fails
      - fsm model update function
  - Only one action is triggered at any given time by incoming events.
 Before another action can be triggered, the pending action must be
 completed : RTC semantics

# API
## Composed types
- `makeFSM :: Events -> Transitions -> StateEntryComponents -> FSM_Model -> [SinkName] -> ActionResponses -> Component`
- `ActionResponses` :: [SourceName]
- `Sources :: HashMap SourceName (Source *)`
- `Events :: HashMap EventName Event`
- `Event :: Sources -> Source EventData`
- `Transitions :: HashMap TransitionName Transition`
- `Request : Record {
    command :: Command
    payload :: Payload
  }`
- `ActionRequest : Record {
    driver :: SinkName
    request :: (FSM_Model -> EventData) -> Request
  }`
- `UpdateOperation :: Set Path Value | Delete Path | Update Path Value`
- `Transition :: Record {
    origin_state :: State
    target_state :: State
    fallback_state :: State -- if action fails
    trigger :: EventName
    action_request :: ActionRequest
    model_update :: FSM_Model -> EventData -> ActionResponse -> UpdateOperations
    fallback_model_update :: FSM_Model -> EventData -> ActionRequest -> [UpdateOperation]
  }`
- `StateEntryComponents :: HashMap State StateEntryComponent`
- `StateEntryComponent :: FSM_Model -> Component`

## Terminal types
- `FSM_Model :: Object`
- `Payload :: *`
- `EventData :: *`
- `Command :: String`
- `EventName :: String`
- `State :: String`

# FSM specifications
## Contracts
- there MUST be an `INIT` event, 
- For the `INIT` event, there MUST be a defined success/error transition
- an event MUST be matched to ONE (success, fail) transition - no guards for now

## Behaviour
When we refer to an event, we implicitly refer to an event configured to be handled by a FSM.

### Transitions
#### Success
- GIVEN : FSM `Model`, transition `ev -> O -> Ts -> Tf -> Ar -> Us -> Uf`,  
  - WHEN `ev ev_data` occurs THEN 
     - `Ar.request` is called with `Model`, `ev_data`
     - FSM component emits {driver_name : `Ar.request return value`}
  - WHEN `Ar.request` succeeds THEN
     - `model_update` function is executed with the required parameters
     - The component selector function associated to`Ts` is executed with the right parameters (`Model`)
     - The component returned by the selector function is initialized

TODO : change types to have guards on action response. That should handle success/error case, and add other cases, but extra contract, at least ONE and at most ONE of these guards must pass, so for now for simplicity force it to be only those two
TODO : add action responses to the design, actually could be `sinkNames` param to start with

#### Error
cf. previous and replace success by error


// event E: click on one team - these are only event CHANGING fsm state!!
// NOT SAME
// - {teamData}
// transition : [
// - Sa, E, success, Sb,
// - {targetDriver: (fsmModel, teamData) => action request}
// - (fsmModel, teamData, response) => operation on model]

// fsm(events, transitions, stateVsComponentMap) : component
// stateVsComponentMap :: state => model => component

merge(labelledEvents.startWith(init))
  .scan ((init, no pending, no action request, init model, orig. event data), (fsmInternalState, event) => {
  if pending action :
    if event not corresponding/expected action response (from label)
      discard/maybe warning
    else :
      update internal model cf. transition success/error -MUST synchronous
      log operations on model somewhere (external fsm driver??) - MAY async., MUST SUCCEED
      set internal state to transition success/error target state
      emit component configured in transition
  else new action request :
    if configured in transition
      pending : YES, action request : targetDriver (label), state, model is same
      orig event data = action request event data
      emit : {targetDriver : ..} according to transition
    else FATAL ERROR : must be configured in fsm
}).
switchMap({state, pending, action request, model, orig event data} => {
  if pending :
    emit : {targetDriver : ..} according to transition
  else :
    emit component configured in transition
})
!! this is a switch on component!!
  means no more events are processed while executing actions (GOOD!)
    - behaviours if processed with combineLatest keep their values (DOM)
