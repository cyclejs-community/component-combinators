# Introduction
A web application's user interface can be understood as a reactive system which displays a sequence of screens and perform a sequence of commands which are determined unequivocally by user actions, the application domain logic, and contextual data from the application's environment (from miscellaneous databases, sensor inputs, etc.). We aim to show that, under some restrictive conditions, using a state machine to control that sequence, allow for better modelization, specification, testing and implementation of such user interface.

We will use all along the presentation of the relevant concepts an average-complexity example application. We hence start with introducing that application (functional specification, lo-fi wireframes, and user experience flowcharts).

[//]: # (this could be put in annex, or just before the sample implementation)

We continue with taking some distance to reflect on the pain points of human-computer user interface design and implementation. We present patterns which have been used to alleviate those pain points.

We will then show how an asynchronous extended state machine complements these approaches and present our proposed asynchronous extended state machine library, and an implementation of the sample application, exemplifying how such a state machine implementation reacts well to changes in the specification.

We will finish by exposing the restrictive conditions under which a state machine is a good fit for user interface modelization, and discuss various ways to create those restrictive conditions in some circumstances when they do not naturally appear.

**Prerequisites**

- `cyclejs` knowledge for the implementation section
- knowledge of stream concepts, and implementations

## Reactive systems are hard to specify
There appears to be agreement in the literature on software and systems engineering as to the existence of a major problem in the specification and design of large and complex reactive systems. A reactive system (see [22] and [39]), in contrast with a transformational system, is characterized by being event driven, continuously having to react to external and internal stimuli. Examples include telephones, communication networks, computer operating systems, avionics systems, VLSI circuits, and the manmachine interface of many kinds of ordinary software.

The problem is rooted in the difficulty of describing
reactive behavior in ways that are clear and realistic,
and at the same time formal and rigorous, in order to
be amenable to precise computerized analysis.
The behavior of a reactive system is really the set of
allowed sequences of input and output events, conditions,
and actions, perhaps with some additional information
such as timing constraints.
What makes the problem especially acute is the fact that
a set of sequences (usually a very large and complex one)
does not seem to lend itself naturally to ‘friendly’ gradual,
level-by-level descriptions, that would fit nicely
into a human being’s frame of mind[David Harel].
This results in discrepancies both between the intended design and the actual design (design bug), and between the actual design and the implementation (implementation bug).

## Functional reactive programming with streams helps to implement but not to communicate the design
If we focus on the problem space of man-machine interface in the software domain (i.e. graphical user interface or GUI), a promising design paradigm is functional reactive programming.

A reactive system is described as the sequence of its reactions to inputs, that is a relation `(re)action = f(event)`, where `event` is taken from a set of events that the GUI is reponsive to, and `action` is the associated reaction intended by the user/actor who triggered the event.

A functional reactive program describes the behaviour of the reactive system as `actions = f(events)` where :

- `events` is a (push)stream (possibly unbounded sequence of data) of incoming events that the GUI responds to,
- `actions` a (push)stream of the corresponding reactions
- `f` is a pure function

For reactive systems who can be defined by their set of traces over the space of expected events,  i.e. `{(events, actions) | events = [event | Events]}`, the functional reactive allow to check  the correct behaviour of a system for a pair `(events, actions)`, by simply simulating the events sequence, and checking that the `actions` stream conforms to the specified trace.

For practical purposes, the set of traces being generally infinite, gray-box testing techniques can be used to reduce considerably the set of traces under test.

However, the functional reactive programming with streams approach suffers from two key issues:

- streams are great for processing asynchronous dataflows, but it can be arduous to implement control flow (jumping, conditional branching, looping, etc.)
- while dataflow tracing is considerably improved in the absence of complex control flow, a human-readable version of the design is hard to derive in the general case from the reactive implementation `f`. Yet, that design does occur first, in order to write `f`, only that it is lost and eclipsed by the implementation.

## State machines are great to specify control-driven reactive systems
### A state machine is...
A finite state machine (FSM) is a machine specified by a finite set of conditions of existence (called states) and a likewise finite set of transitions among states triggered by events�[Douglass 2003, chap.1]

Finite state machines model behavior where responses to future events depend upon previous events. There is a rich body of academic literature in this field, but a useful working definition is straightforward. Finite state machines are computer programs that consist of:

- *Events* that the program responds to
- *States* where the program waits between events
- *Transitions* between states in response to events
- *Actions* taken during transitions
- *Variables* that hold values needed by actions between events. The set of those variables is referred to as *model*.

The events that drive finite state machines can be external to the computer, originating from a keyboard, mouse, timer, or network activity, or they can be internal to the computer, originating from other parts of the application program, or other applications.

### From event-action paradigm to event-state-action paradigm
We already mentioned that a GUI follows an event-action paradigm. The user initiates events by interacting with the user interface, and those events are meant to produce the corresponding actions intended by the designer of the user interface. In the simplest case, we have `action = f(event)`, and action depends only of the event.

In reality, this is no always the case. The action to be performed often depends not only the triggering event but on the history of events and actions which have taken place before ; or on the context in which the event takes place. For instance:

 - a toggle button click can have two actions associated, according to its current state.
 - in a cd player, the play button triggers `close the cd tray and play`, if the tray is opened, `play` if the cd player is not playing or is paused, `pause` if the cd player is currently playing
 - in a video game AI, a game agent might have a state `Patrol` wherein it wanders the map looking for enemies. Once it detects an enemy, it transitions into the `Attack` state. If the target starts taking shots at our agent, it might momentarily transition into the `TakeCover` state (a "blip") before transitioning back to `Attack`
 - A large number of enterprise applications are workflow-driven systems in which documents/files/processes transition from state to state

we can then rewrite our equation as `action = f(event, context)` where context modelizes somehow the relevant and necessary contextual data. In the case where we can discriminate discrete logical branching points which determine the triggered action (`isToggled`, or `carriesWeapon`, etc.), we can write this equation `action = f(event, state, model)`, where :

- `f` is a pure function,
- `state` is to be understood in the state machine sense (`isToggled` etc., we will call that `logical state`),
 - `model` is the contextual data necessary to parameterize the action to be triggered (we will call that `quantitative state` or simply just `model`).

Transitions between state hence allow to express complex control flow with a simple vocabulary.

### GUI design can be communicated easily via a auto-generated state-machine diagram
As all the logic behind the transitions are completely and unequivocally specified by the parameters of the state machine, it is possible to draw a reliable graph which constitutes a visualization of the design of the user interface. That visualization can be automated and gives to computer-based analysis which can reveal insight about the design strengths or weakness.

But in fact, first and foremost, writing a state machine **forces** to design first and accurately before implementing.

### Test of the GUI design can be automatically generated
The state machine is a direct representation of the design as an object, and as such a battery of tests can be automatically derived to prove the correctness of the implementation.

### Robustness is considerably enhanced
This comes from the following properties:

- Events which are not specified for a given state are not processed when in that state
- Transitions are deterministic, hence the system is always in a predictable and expected state

# An asynchronous state machine library for robust, maintainable, self-documenting user interfaces

TODO : I am here



Most notable among the solutions proposed for this
problem are Petri nets [41], communicating sequential
processing (CSP) [26]. the calculus of communicating
systems (CCS) [Xi], the sequence diagrams of [51], ESTEREL, [2], and temporal logic [39]. Statecharts constitute yet another attempt at solving this problem, but
one that is aimed at reviving the classical formalism of
finite-state machines (FSMs) and their visual counterpart, state-transition diagrams, trying to make them
suitable for use in large and complex applications. Indeed, ,people working on the design of really complex
systems have all but given up on the use of conventional FSMs and their state diagrams for several reasons:
- (1) State diagrams are “flat.” They provide no natu
ral notion of depth, hierarchy, or modularity, and
therefore do not support stepwise, top-down, or bottom
up development.
- (2) State diagrams are uneconomical when it comes
to transitions. An event that causes the very same tran
sition from a large number of states, such as a high
level interrupt, must be attached to each of them sepa
rately resulting in an unnecessary multitude of arrows.
- (3) State diagrams are extremely uneconomical, in
deed quite infeasible, when it comes to states (at least
when .states are interpreted in the usual way as “snap
shots” of the situation at a given point in time). As the
system under description grows linearly, the number of
states Igrows exponentially, and the conventional FSM
formalism forces one to explicitly represent them all.
- (4) Finally, state diagrams are inherently sequential
in nature and do not cater for concurrency in a natural
way.8

TODO : integrate that somehow

# Finite state machines

In the following sections, we will :

- introduce an average-complexity user interface specification
- formalize that user interface behaviour using a finite state machine
- explain the rationale for using a state machine for user interface applications
- present an implementation of the user interface specification using the proposed library
- introduce the formal syntax for the state machine configuration

# `Apply to colleges` application
## High-level specifications
The following describes a fictitious application which allows a prospective student to apply to a given college.

Every college requires prospective students to :

- provide minimal data about themselves
- answer a question whose answer will be reviewed by the admission officers
- pre-apply for a list of classes by answering a specific motivational question on that class

The designed process to allow a student to apply to several colleges with the minimal amount of steps is the following :

- fill-in personal information
- answer the college admission question
- review all classes and join the one he/she is interested in
- for each selected class, the student can review some details about that class and answer the class mandatory application question
- at the end of the process, the student reviews its choices
- from there, the student can either finalize its application, or modify its application

90% of students are using the application on low-tech small-screen mobile.

All data about classes and colleges is available and stored on a back-end.

The user application must be stored so that if the student interrupts its application in a given step, it can resume that application at a convenient starting point.

## Wireframing
This corresponding to a user-experience around a multi-step process corresponding to the following low-fi wireframes :
![state machine diagram](file:///C:/Users/toshiba/Desktop/application_process__wf-1__1_dec_16__ap_hb_sd_.png)
[put some wireframes here - might have to draw them myself...]

## Modelizing the application behaviour with a state machine
 As one can observe from the wireframes, we have events (button clicks) which leads to changing screens (states), if certain conditions are fulfilled (for example, the student cannot go on to the review step if no classes have been subscribed to).

 That makes the modelization of behaviour pretty immediate :
 - each screen will represent a state
   - hence, we have 5 states
 - the state machine will listen for events which can cause change of states
   - button clicks (`Continue`, `Join`, `Skip`, `Change`, `Apply`, click to select a class)
 - a fetch event will be used to fetch past data from the back-end
 - event guards and action guards will be defined to implement the conditions associated to the transitions
 - the state machine model will hold :
   - remote persistent state, i.e. a copy of relevant data from the back-end (college information,
   classes information, etc.)
   - user-application state (which classes have been joined, answers to questions, in which step of the application the student is currently in, etc.)
  - every transition will update the model with the new state of the user application, and when relevant synchronize with the back-end.

This leads to the following diagram.
![state machine diagram](file:///C:\Users\toshiba\WebstormProjects\component-combinators\src\assets\FSM\sparks application process with comeback fsm.png)

## Rationale for using a state machine modelization
### Event-action paradigm
A GUI follows an event-action paradigm. The user initiates events by interacting with the user
interface, and those events are meant to produce the corresponding actions intended by the
designer of the user interface. In the simplest case, we have `action = f(event)`.

In reality, this is no always the case. The action to be performed often depends not only the
triggering event but on the history of events and actions which have taken place before ; or on
the context in which the event takes place. For instance:

 - a toggle button click can have two actions associated, according to its current state.
 - in a video game, the space key can trigger the `jump` action if the player carries no weapon,
 or `fire` if it has loaded one.
 - in a cd player, the play button triggers `close the cd tray and play`, if the tray is opened,
 `play` if the cd player is not playing or is paused, `pause` if the cd player is currently playing

### Event-state-action paradigm
That is the same to say, that `action = f(event, context)` where context holds somehow the relevant
and necessary contextual data. In the case where we can discriminate a few logical branching points
which determine the triggered action (`isToggled`, or `carriesWeapon`, etc.), we can write this equation
`action = f(event, state, model)`, where state is to be understood in the state machine sense,
and model is the contextual data necessary to parameterize the action to be triggered.

This is where a finite state machine can be a good formalism to express the 'event to action'
function.

### When is a finite state machine a good fit
- actions are triggered by discrete user events
- user interface triggers actions which are not a pure function of the triggering event
- the action logic can be modelized by using a **low number of states** (i.e. logical branches)

However, while the traditional FSMs are an excellent tool for tackling smaller problems, it is also generally known that they tend to become unmanageable even for moderately involved systems. Due to the phenomenon known as "state explosion", the complexity of a traditional FSM tends to grow much faster than the complexity of the reactive system it describes.

### Benefits of the finite state machine formalism
- it is a formalism, i.e. a **systematic** way to express the actions of a reactive system as a
function of its state. That means that it is easy to figure out that logic, even 10 months
after the fact, once the formalism is learnt.
- self-documenting
  - the corresponding graph with its transitions from state to state can be automatically
  generated and drawn, allowing for a clear visual representation of the state machine
- solid principles
  - all functions part of the state machine configuration do only one thing,
  - open for extension/closed for modification : adding new behaviour can be achieved by adding to
  the state machine configuration without modifying existing code
- more maintainable
  - that is a consequence of solid principles but it is worth isolating it in its own section.
  Given that crafting a good user interface is characteristically an iterative process, it is
  important that incremental changes in specifications result in incremental changes in
  implementation, as much as possible.
- less bug-prone
  - no events can result in an action which has not been configured to do so. This allows to reason
  better about the program and its invariants
  - concurrency, a major source of bugs in software in general, and in user interface software in
   general is handled in predictable ways with state machines. You cannot pay twice by clicking
   twice the `pay` button as the second click will happen with the state machine in another
   state, in which it does not listen to that button click. Run-To-Completion (RTC) semantics also
   ensure that no further actions will be started while the current action is not completed,
   eliminating concurrency hazards[^1].
- easily testable :
  - provided the state machine library is thoroughly tested, there is no need to
test the logic any longer, only the functional bits (event generation, guards, model updates, etc
.), most of which are pure functions
  - if necessary, the event-to-action function specifications (i.e. tests) can be
  automatically generated - they are exactly the definition of the state machine
  - it is easy to automate orthogonal effects (tracing, logging, spying) by adding the
  corresponding  aspects to the  functions part of the state machine definition ; while still
  guaranteeing the continuing good behaviour of the state machine

   [^1]: This goes a tad contrary to optimistic updates, formula under which you assume a
   user-triggered action will be successfully executed and update the user interface accordingly and wait for
    further user events without waiting for notification of the action execution. This also means
     that the action to execute should be short (<< 16ms if one wants 60fps) which in some
      user applications can complexify the design.

## Example implementation
TODO : A lot of program lines, so put that in another document? or just a link to the source code

# API
In order to achieve a ... management of events, together with asynchronous actions, the state machine library have been built around :
- streams for management of asynchrony and time-varying behaviours
- functional (reactive) programming for reusability

## The functional reactive paradigm
The reactive paradigm sees a program as a series of reactions to incoming events.
As such as it naturally fits the nature of the GUI problem, where user generate events, and the
GUI generate actions in response to those events.

 We hence have a program expressed as `context_0`, `action_n = f(event_n, context_n)`, where :
 - `context_0` is the initial contextual data,
 - `action_n`  encapsulate a command which will be received by an interpreter in charge of
 executing such command,
 - and a possible modification of the contextual data, leading to `context_n+1`, the value of
 `context` when `event_n+1` occurs.
 - `f` is a computation

The functional paradigm sees a program as a relationship between its inputs and its output that
mimic semantics of mathematical functions:
- if `y=f(x)` and `z=f(x)` then `y=z` - this is sometimes referred to as referential equality.
This means that evaluating a function at a given point at any point in time will always give the
same result. A function which exhibits such properties is called a pure function.

A program is hence a series of relationships that are always true, which makes the functional
paradigm a declarative programming paradigm. Programming is done with expressions or
declarations instead of statements (no assigments). Complex functions, i.e. complex
relationships are constructed from smaller ones, through combinators, the most important of which
 are composition and passing functions as data parameters.

The fusion of the functional paradigm and the reactive paradigm requires the stream abstraction and
results in programs being written as:
- `actions = f(events, context)`
where events and actions are `events` and context is a `behaviour`, both being streams (sometimes
 called signals) with the characteristics that:
 - `events` is a stream of `event` which is a discrete value determined at a given time
 (essentially  equivalent to `(time of occurrence, event data)`)
 - behaviours always have a value which can be sampled through events, and which change discretely
 through events
 - `f` is a pure function
 - actions may or may not lead to changes to the contextual data, depending on the effects
 associated to them by the interpreter who processes them.

If we take the college application example, part of the context would be the data (a local copy
thereof) stored in the
database, as well as the form data stored in the DOM (the DOM also is a database). When user
moves from one step to another, data is saved in the database, hence changing the context. When
the user fills in some form fields, the DOM is changed, hence also changing the context.

 When a user clicks on `Continue` button, the context (DOM input fields) is read, and if the
 fields data pass validation, the state machine changes state.

  When the user starts the application, and there is already some previous application data stored
   in the database, that previous data is fetched and the state is computed as a function of the
   last stored step of the application.

## State machine component
### Rationale
As we have seen, the functional reactive paradigm allow to express an application (understood as
a set of actions taken in response to user events) as a pure function `f` such that `actions = f
(events)`. We call such a `f` function a dataflow component or more simply a component. When `f`
will be understood as being connected to effect managers/interpreters, we might also refer to `f`
  as an application. Please however note that this is but a convenient misuse of language.

The proposed state machine component is a higher-order component which adds control flow to
dataflow. Dataflow essentially describes a linear path, from a source to a destination, through
data transformations (trivially `sink = source.map(transformation)`). Control flow allow control
constructs (sequential execution, conditional jumps, loops, exceptions, etc.) A control
flow task is doing nothing in itself TO the data. It does however identify the next task to be
executed, in function of the current state, and result of previous tasks execution. Hence control
 flow adds branching capability to what otherwise would be purely linear dataflow graph.

````
 Exhibit A
 S- - - - - -D vs. S- - - - - - D
                    | |     /
                    |  - -
                     \   |
                       - -
````

As such the proposed state machine component allows to sequence an application into
sub-applications according to a series of rules enclosed in its configuration, such that:
- an initial event is fired upon initialization of the state machine which leads to an initial state
- the state machine changes state as a function of the incoming events it is configured to pay
attention to, and the guards and transitions defined for the current state it is in
- sub-applications corresponding to states of the state machines and are started upon entry in
those states
- sub-applications can have their private state, as usual, that no other component will have
access to
- sub-applications can only have a read access to their enclosing context (i.e. the model
associated to the state machine)
- sub-applications are not aware of and do not control their lifecycle. That is done by the state
machine component

 Going back to the example college application, the example implementation uses a state machine
 which sequences the application into 5 steps (states) to which correspond 5 screens
 (sub-applications), and controls the transition from one state to another according to
 configured college-application-specific rules.

## `makeFsm :: Events -> Transitions -> EntryComponents -> FsmSettings -> Component`
Creates and returns a state machine component whose behaviour is defined by :
- the events handled by the state machines
- the states of the state machine and the associated components to be started upon entry in those
states
- the transitions between states
- the state machine settings

### Events
#### Types
- `Events :: (HashMap EventName Event) | {}`
- `Event :: Sources -> Settings -> Stream EventData`
- `EventNmae :: String`
- `EventData :: *`
#### Contracts
- The `EV_INIT` event is reserved and MUST NOT be used in user-defined event
configuration
- For the `INIT` event, there MUST be a defined success/error transition
- There MUST be an init event and transition configured (**implemented??**)

#### Description
Events to be processed by the state machine are defined through event factories. The `events`
parameter maps an event name to an event factory which once executed will return a stream of
events associated to that event name.

The event factory receives the same `sources` arguments than the state machine component, hence
is injected the same dependencies than the state machine component.

TODO : QUID OF THE SETTINGS ARGUMENT??

NOTE : the stream of events returned by the factory MAY have an immediate starting event.
However, there should only ever be one of such (FETCH event for instance), as all starting events
 for all stream of events will be executed in order of definition, right after the reserved initial
 event. The library does not offer the possibility for now to have immediate events triggered
 automatically by entering a state (no transient state, no immediate preemption).

### Transitions
#### Types
- `Transitions :: HashMap TransitionName TransitionOptions`
- `TransitionOptions :: Record {
        origin_state :: State // Must exist in StateEntryComponents,
        event :: EventName // Must exist in Events,
        target_states :: [Transition]
      }`
- `Transition :: Record {
    event_guard :: EventGuard  | Null,
    re_entry :: Boolean | Null,
    action_request :: ActionRequest | Null,
    transition_evaluation :: [TransEval]
  }`
- `TransEval :: Record {
    action_guard :: ActionGuard | Null,
    target_state :: State // Must exist in StateEntryComponents,
    model_update :: FSM_Model -> EventData -> ActionResponse -> Settings -> [UpdateOperation]
  }`
- `ActionGuard :: Model -> ActionResponse -> Boolean`
- `EventGuard :: Model -> EventData -> Boolean`
- `ActionRequest :: Record {
    driver :: SinkName | Null,
    request :: (FSM_Model -> EventData) -> Request
  } `
- `Request : Record {
    context :: *,
    command :: Command,
    payload :: Payload | Null,
  }`
- `ActionResponse :: Record {
    request : ActionRequest,
    response : * | Null,
    err : Error | Null,
  }`
- `UpdateOperation :: JSON_Patch`
- `JSON_Patch :: Op_Add | Op_Remove | Op_Replace | Op_Move | Op_Copy | Op_Test | Op_None`
- `Op_Add :: Record { op: "add", path: JSON_Pointer, value : *}`
- `Op_Remove :: Record { op: "remove", path: JSON_Pointer}`
- `Op_Replace :: Record { op: "replace", path: JSON_Pointer, value: *}`
- `Op_Move :: Record { op: "move", from: JSON_Pointer, path: JSON_Pointer}`
- `Op_Copy :: Record { op: "copy", from: JSON_Pointer, path: JSON_Pointer}`
- `Op_Test :: Record { op: "test", path: JSON_Pointer, value: *}`
- `Op_None :: {} | Null`

#### Contracts
- any state defined in the `transitions` parameter, must be corresponded with an entry in the
`stateEntryComponents` parameter.
- if a target state can be the same as an origin state, the `re_entry` property MUST be configured
- if a target state differs from an origin state, the `re_entry` property MUST NOT be configured
- A transition MAY have an action response guard
- A transition MAY have an event guard
- If a transition between two states have one or several action response guards, then for any
incoming events, at least ONE of the guards MUST pass.
- (events and actions) guard predicates MUST be pure functions - or more relaxedly MAY have
side-effects which do not affect the evaluation of other guards for the same event
- Run To Completion (RTC) semantics : a state machine completes processing of each event before it can start processing the next event
- Additional events occurring while the state machine is busy processing an event are dropped
- FSM configured functions MUST NOT modify the model object parameter that they receive
- FSM configured functions MUST be synchronous and immediately compute and return their value
- FSM configured functions MAY throw, and that results in the state machine re-throwing the
exception
- if `action_request` property has no driver, then the request field MUST be null
(**implemented??**)
- if `action_request` property is none then `transition_evaluation.action_guard` MUST be Null  (**implemented??**)
- an action request MUST have an action response associated. Otherwise,
the state machine will block without end, waiting for a response.
- if an action request features a driver name, that driver name MUST be found in the sources.
Otherwise, the state machine will block without end, waiting for a response. (**implemented??**)

#### Description
- The state machine starts in the `S_INIT` state, and automatically fires the special reserved
`EV_INIT` event. From then onwards, the state machine behavior is determined by its user-defined
configuration
- Given that the state machine is in a origin state, and given an incoming event :
  - when that incoming event does not have a configured transition associated, a warning is
  issued and the event is discarded. That is the case for not configured user-event but also for
  responses to requests (arriving for instance while the state machine is not expecting them).
  - when that incoming event has a configured transition associated, then :
    - when there are no event guards, the program behaves as if there was an event guard which
    is always satisfied (`always(true)` predicate)
    - when there are events guards, they are evaluated in order of declaration (i.e. array order)
      - when no event guards are satisfied, a warning is issued, and the incoming event is discarded
      - when an event guard is satisfied :
        - when there is an action request, that action request is sent, and the state
        machine WAITS for a response
          - when a user event arrives, a warning is issued, and the user event is discarded
          - when a response arrives AND matches the request sent, then
            - when there is no action guard, the program behaves as if there was an action guard
            which is always satisfied (`always(true)` predicate)
            - the action guards are executed in order of declaration (i.e. array order)
              - if no action guard is satisfied an exception is raised!
              - if an action guard is satisfied, the state machine's model is updated and transitions
              to the configured target state
          - when a response arrives AND DOES NOT match the request sent, then a warning is issued
          and the response is discarded
        - when there is no action request, the state machine's model is updated and transitions
        to the configured target state

**NOTE**: to prevent unwanted modification of the internal state machine model, the `model`
parameter
 passed to configured state machines' functions is a clone of the internal model. This might have
  some effect on performance, we might consider relaxing this constraint if need be.

**NOTE**: *NOT IMPLEMENTED* :
 - the state machine keeps a journal of the modification of its model (history of update operations
 together with the transitions taken) for debugging purposes or else

### States
#### Types
- `StateEntryComponents :: HashMap State StateEntryComponent`
- `StateEntryComponent :: FSM_Model -> Component | Null`
- `FSM_Model :: *`
- `Component :: Sources -> Settings -> Sinks`
- `Sinks :: HashMap SinkName (Stream *)`
#### Contracts
- The starting state is `S_INIT` and is reserved and cannot be used in user-defined state
configuration, other than to represent the starting state.
- States MAY be associated to entry actions which is the instantiation of a component
- States defined in transition parameter MUST exist in `stateEntryComponents`
- the `S_INIT` state MUST be associated ONLY with transitions featuring `EV_INIT` event
(**NOT implemented??**).

NOTE :: an state machine configured with an event guard such that the init event fails will remain
 in limbo (init_state) : the init event will not be repeated, hence the state machine will never
 transition.


#### Description
The states that the state machines can navigate to are necessarily the keys of the
`stateEntryComponents` parameters. To each such state/key, a component is associated. That
component will be initialized upon entering the state, and stopped upon exiting that state.

It should be noted that depending on the configuration of the state machine, in particular in
line with the `re_entry` configuration parameter, the component may or may not be re-initialized in
the special case of a state machine exiting one state and re-entering the same state.

The returned component is taking the same `sources` parameters than the state machine component, hence
is injected the same dependencies than the state machine component.

TODO : QUID OF THE SETTINGS ARGUMENT??

Its `sinks` output is merged with the state machine component output and should then
logically be passed downstream to the sinks interpreter.

### State machine settings
#### Types
 ```
 FSM_Settings :: Record {
     initial_model :: FSM_Model
     init_event_data :: EventData
     sinkNames :: [SinkName] | []
     debug: Boolean | Null
   }
   ```

#### Description
- `initial_model` : initial value of the state machine model
- `init_event_data` : data to be included in the initial event upon initialization of the state
machine
- `sinkNames` : names of the sink which will be output by the state machine. This is parameter is
 of paramount importance, as no sinks which are not included here will be output and processed by
  the state machine.
- `debug` : if set to `true`, automatically adds logging and tracing aspects to all functions
used in the state machine configuration. This includes, event factory, event streams, actions,
actions guards, event guards, and state entry components. NOTE : at the moment, state entry
components sinks are not traced with that settings.

**TODO**

## Examples of state machines
Simple example, showing all the tests (with action guards, without etc.) with graphs and
simulations. Will be important to have a trace

**TODO**

# Pre-requisites
- programming with streams


# Extensibility - a case study
Let's say that after a while we want to add the following specifications:
- we want to add validation to every field for the application
- when the user has already applied AND the application has not been decided upon yet, he can
review  its application. On entering the  application
url, he will directly get to the review page. He will then be able to modify its application by
navigating to the relevant portion of its application
- when the user has already applied AND the application has been decided upon, the student is
notified of the result of the application and does not have access to its application any longer.
 - when skipping a class, we want to save the answer to the motivational question, so when the
 student changes his mind comes back to that team, he does not have to re-enter an answer from
 scratch.

TODO : new graph, emphasizing the new nodes and transitions ; new code, update of existing code :
 count it and show we modify very little

# Reusability
We presented an example using `cycle-js` as a framework. We also could have used Angular 2 with no modifications to the library. We however will have to adjust the interface.

## `Apply to colleges` application with Angular 2

# Roadmap

**TODO**

# References and prior work
As far as user interface is concerned, a common reference is *Constructing the user interface with statecharts*   by Ian Horrocks. A valuable ressource from the inventor of the graphical language of the statecharts is  *Modeling Reactive Systems with Statecharts: The STATEMATE Approach*  by Professor David Harel.

Why Statecharts Based Design? Why Statecharts Based Design? :
http://msdl.cs.mcgill.ca/people/hv/teaching/MSBDesign/COMP762B2003/presentations/GUIdesign.pdf

Challenges of HCI Design and Implementation, Brad Meyers, 1994
http://www.academia.edu/2670597/Challenges_of_HCI_design_and_implementation

Practical Principled FRP - Forget the past, change the future, FRPNow!, Atze van der Ploeg ; Koen
Claessen, 2015
http://publications.lib.chalmers.se/publication/231133-practical-principled-frp-forget-the-past-change-the-future-frpnow

Design Patterns for Embedded Systems in C: An Embedded Software Engineering Toolkit
By Bruce Powel Douglass, 2003


# deambulations intellectuelles
cycle function : sinks = g(source)
me :
- `action = f(event)` - `f` pure
- `actions = f(events)` - `f` pure
- `events`, `actions` are (possibly multiplexed) streams

lien entre f et g?
- `g = makeDataflowComponent(dependencies, actionWithResponseNames, eventFactory, f)`
  - `eventFactory :: dependencies -> [actionResponses] -> Record (events :: ..., actionAllNames::
  [String]`
  - `actionWithResponseNames` is the list of subjects which will be linked to the drivers
    - ONLY those drivers which handle response/request
    - If driver if only one-way, no need to include the name
    - !! find a better name?? response-request-action-names?
  - `actionAllNames` is the list of ALL action types, including the one-way actions
  - `actionSubjects` is a list of subjects which will be used as driver sources for the event
  factory function
  - `f :: events -> actions`
    - `actions` may be a multiplexed stream of individual action to pass to an actuator ::
`Stream<HashMap<ActionName, ActionRequest>>`
    - `actions` may be a stream of array of actions representing the requirement for those
    actions to  be executed as one (transaction concept).
    - in `cyclejs`, actions are dispatched to sinks collected in a hashmap, which are fairly
independent one from the other (inherently concurrent), making it difficult to express ordering,
interdependence, synchronization or transaction semantics.
  - `events` are events, while `dependencies` are injected modules which interact with the external
 environment (we could call them sensors, as they serve to detect, respond to or measure a property
  of  the external environment).
 As such, dependencies include behaviour factories. The content of form fields, the content of a
 database, in general any locally or remotely **stored** data source are behaviours. Dependencies could be
 a way to read the value stored in those media.
  Dependencies also detect events. A click on a button, the update of a table in a database, a
  change in connection status are events which can be read from external systems.
  Events are however of a discrete nature, even when they are computed using behaviours. An event
   should pass all data necessary to carry forth the domain-specific intent it relates to.
    - `events` may take the form of a multiplexed stream : `events :: Stream<HashMap<EventName,
 EventData>>`
      - this syntax has the advantage of making it easy to test/trace/replay a sequence of
      events, as the ordering of events is made apparent
    - `events` may take the form of a hash of streams : `events : HashMap<EventName,
 Stream<EventData>>`
      - this is the syntax used by `cyclejs`
- `DataflowComponentDef :: Record {dependencies, actionWithResponseNames, eventFactory, f}`
- `makeCycleDataflowComponent :: DataflowComponentDef -> CycleDataflowComponent`
- `CycleDataflowComponent :: Sources -> Sinks` (`Sinks :: Actions`)
- `g' = makeCycleDataflowComponent(dependencies, actionWithResponseNames, eventFactory, f)`
  - `g' :: sources -> actions`, where `sources` has all keys from `dependencies` and
  `eventFactory.eventNames` (NOT the keys from `behaviourNames`)
  - `g' := sources -> f(events)` where
    - `events = eventFactory(sources, [sources.actionWithResponseNames]).events` WHEN the key is not in `sources`
      - `sources` keys MUST have ALL the keys from `dependencies` : CONTRACT
      - `sources` keys MUST have ALL `actionWithResponseNames` : CONTRACT

- `Actuators :: HashMap<ActionName, Actuator>`
- `Actuator :: Sink -> Source`
- `Imports:: [ImportEventName]`, where `ImportEventName :: EventName`
- `Exports:: [ExportEventName]`, where `ExportEventName :: EventName`

- `ApplicationDef :: Record {dependencies, actionWithResponseNames, eventFactory, f, actuators, imports, exports}`
- `makeApplication :: ApplicationDef -> Application`
- `Application :: Record {run, suspend, resume, stop}`
  - `actuators` is used as a synonym to drivers
  - `exports` is the array of names of events which is intended to be visible out of the component.
  This is useful to define an interface to compose applications
  - `run`
    - executes the `eventFactory` with a hash of subjects corresponding to :
      -  `actionWithResponseNames` (actions are events so standard subjects, never behaviour)
      -  `imports` (imports are events so standard subjects, never behaviour)
    - apply the function `f` to the resulting events
    - connect the action responses (`actionWithResponseNames`) to the action requests subjects
  - `stop`
    - disconnect responses to requests
    - dispose of all subjects and extra resources
    - interrupt definitively the execution :: !! semantics to think about, cant we restart? is
    that stateful?? whe already have resume anyways
  - `suspend` : temporarily silence all action requests !! semantics to define vs. log/trace-ing
  - `resume` : resume processing of all action requests
  - !! behaviour when error to define too
- `composeApplications :: ApplicationDef -> ApplicationDef -> ApplicationInterface -> ApplicationDef`
  - `appDefResult = composeApplications (appDefTarget, appDefSource, appInterface)`
    - sensitive to order
    - the first application takes events from the second application
    - `appDefResult.eventFactory`
      - its eventFactory creates events from:
        - `addDefTarget.dependencies`
        - `addDefTarget.actionWithResponseNames`
        - the `imports` of `appDefTarget`
        - i.e. nothing different, all as usual, we will map and connect elsewhere
    - `appDefResult.dependencies`
      - same dependencies as `appDefTarget.dependencies`
!! NO NO NO NO I have to have AppDefTarget -> AppDefSource -> AppInterface -> App !!! because
only the `run` etc. methods will actually change!! And I can't put the def in the {run...}
because the composed app does not have a def linked to the `run` in the same way (hidden
dependency). And `AppInterface` is rather a mapping specific to this particular composition... so
 change the name. And then we might want a transform between the two, call that a `ConnectorDef`
 which is :: Record {TranslatedExports, exportsEvents -> TransformedExportsEvents}, the
 translatedExports can be compared to imports of the target app, and are EXACTLY the keys of TransformedExportsEvents

        - the exports of `appDefSource` where they map with `imports` of `appDefTarget` to inputs of
        `appDefResult`
          - `ApplicationInterface :: HashMap<SourceEventName, TargetEventName>`
            - `sourceEventName` is a key from the `exports` parameter of `appDefSource`
            - `targetEventName` is a key from the `exports` parameter of `appDefSource`
      - !NO NO NO NO I have to add `imports` to the definition of an application
      (and `DataflowComponentDef` - update cycle component generation), to declare the
      events ([eventNames] that the application accepts, they will have to match the exports to
      which they are composed. Then the events outputs from an application are linked via a proxy
       subject (facade pattern) to an input subject from the `eventFactory`. Imports are just
       subjects, which will not be connected through drivers. OJO with updating the
       `toCycleComponent` function to add those extra sources. The proxy subjects will be linked
       to the events outputs from the source app with `run`. Exports are [eventNames] they are
       not actionName as they will not be mapped to an actuator

  - `eventFactory :: dependencies -> [actionResponses] -> Record (events :: ..., actionAllNames::
  [String]`


    - result application :
      - `dependencies`
        - merge of both `dependencies`
        - !! ACHTUNG dependencies with same name but different... semantics to define
      - `actionWithResponseNames`
        - we dont know do we
      - eventFactory
        - exports of second app are inputs transformed to events through a logic configured in
        `ApplicationInterface`
          - can be app2.sinkName -> app1.anotherSinkName
          - or can go through a transform function as well Stream -> Stream
          - or can go through a transform function as well all sources of app1+ exportApp2 -> Stream
        - !! TO FINISH
      - f
      - actuators
      - exports
      - !! NO NO NO the `run` cannot be expressed like this or can it??

- Application**Component** because it can be composed to other applications with combinators
- note that `h` still does not do anything, it is a definition of the application component
- `run(h)` is how the application component is started

- `g(sources) = f(eventFactory(sources))`
- how to express the looping response/request?? it is the eventFactory who should take repsonses
as parameter (responses are events - which we do not get from the dependencies), this is why the
`actionNames`, that will the list of all actions and all will be associated a response which may
or may not be used by eventFactory

I need to link action sinks to the event in an event response paradigm : NO, action is linked to
dependencies?


# To include somewhere something from that
No Silver Bullet
I
Like software in general, there is no “silver bullet” 171to make user interface design and
implementation easier. It seems that user interfaces are often more difficult to engineer than
other parts of a system. For example, in addition to the difficulties associated with designing any complex software system, user
interfaces add the following problems:

- designers have difficulty thinking like users
- tasks and domains are complex various aspects of the design must be
balanced (standards, graphic design, technical writing, internationalization, performance, multiple levels of detail, social
factors, legal issues, and implementation time)
existing theories and guidelines are not sufficient
- user Interface design is a creative process
- iterative design is difficult

User interfaces are especially hard to implement because:

- they are hard to design, requiring iterative implementation
- they are reactive and must be programmed from the “inside-out”
- they generally require multiprocessing
- there are real-time requirements for handling input events
the software must be especially robust
while supporting aborting and undoing
of most actions
- it is difficult to test user interface software
today’ s languages do not provide support
for user interfaces
- the tools to help with user interfaces can
be extremely complex
- programmers report an added difficulty
in modularizing user interface software


# noflo - flow based programming
https://noflojs.org/tutorials/canadianness/
