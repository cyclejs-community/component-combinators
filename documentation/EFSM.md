[TOC]

# Introduction
A web application's user interface can be understood as a reactive system which displays a sequence of screens and perform a sequence of commands which are determined unequivocally by user actions, the application domain logic, and contextual data from the application's environment (from miscellaneous databases, sensor inputs, etc.). We aim to show that, under some restrictive conditions, using a state machine to control that sequence, allow for better modelization, specification, testing and implementation of such user interface.

We will use all along the presentation of the relevant concepts an average-complexity example application. We hence start with introducing that application (functional specification, lo-fi wireframes, and user experience flowcharts).

[//]: # (this could be put in annex, or just before the sample implementation)

We continue with taking some distance to reflect on the pain points of human-computer user interface design and implementation. We present patterns which have been used to alleviate some of those pain points.

We will then show how an asynchronous extended state machine complements these approaches and present our proposed asynchronous extended state machine library, and an implementation of the sample application, exemplifying how such a state machine implementation reacts well to changes in the specification.

We will finish by exposing the restrictive conditions under which a state machine is a good fit for user interface modelization, and discuss various ways to create those restrictive conditions in some circumstances when they do not naturally appear.

**Prerequisites**

- understanding of stream concepts
- `cyclejs` knowledge, and Rxjs library knowledge for the implementation section
- `JSON patch` RFC 6902

# Sample application

We will describe a user interface application which allows a volunteer to apply for a festival. That description consists of :

- functional specifications
- wireframes flows

## High-level specifications

### Initial version
Every festival requires prospective volunteers to :

- provide pieces of information about themselves
- answer a motivational question whose answer will be reviewed by the volunteer coordinator
- apply for a list of volunteers' teams by answering a specific motivational question on that team

The designed process to allow a volunteer to apply to several teams with the minimal amount of steps is the following :

- fill-in personal information
- answer the festival's motivational question
- review all teams which can be joined and join the one he/she is interested in
- for each selected team, the student can review some details about that team and answer a team-specific motivational question
	- the volunteers cannot continue to the review step if he has applied to no team
- at the end of the process, the volunteer reviews its choices
- from there, the volunteer can either finalize his application, or modify his application

If the student interrupts its application in a given step, it can resume that application at a convenient starting point.
When reaching the review step, the volunteer can modify his application, choosing the section of the application he wants to modify. When he finishes doing so, the next step must be to go back to the review step, where he sees all information about his application.

Other relevant information :
- 90% of students are using the application on low-tech small-screen mobile.
- All data about festival and teams is available and stored on a remote repository.
- When the volunteers' application is finalized, the application data is saved in the remote repository.

### Second iteration (after user feedback)
Before continuing to the next step of the application, user inputs must be checked for validity. When some inputs are invalid, the relevant error messages will be displayed.

## Wireframes 
After discussion with stakeholders, the proposed flow is summarized with the following wireframes :

![(Application process wireframes)](http://i.imgur.com/BFjfgWZ.png "Application process wireframes")


# Challenges of human-computer interface design and implementation

in addition to the difficulties associated with designing any complex software system, user interfaces add the following problems :

- user interfaces are reactive systems, they are hard to specify
- they often require managing asynchrony, and concurrency
- user interfaces design (hence implementation) is an iterative process. An initial design is refined through feedback from the relevant stakeholders
- robustness is paramount, as the user interface will frequently receive unexpected/malformed inputs
 
## Reactive systems design is hard to specify and communicate 
A reactive system, in contrast with a transformational system, is characterized by being event driven, continuously having to react to external and internal stimuli. 
The problem in specifying reactive systems is rooted in the difficulty of describing reactive behavior in ways that are clear and realistic, and at the same time formal and rigorous, in order to be amenable to precise computerized analysis.

The behavior of a reactive system is really the set of allowed sequences of input and output events, conditions, and actions, perhaps with some additional information such as timing constraints.
What makes the problem especially acute is the fact that a set of sequences (usually a large and complex one) does not seem to lend itself naturally to 'friendly' gradual, level-by-level descriptions, that would fit nicely into a human being’s frame of mind[David Harel].

This results in discrepancies both between the intended design and the actual design (design bug), and between the actual design and the implementation (implementation bug).

## User interface design is a creative, iterative process which means implementation is constantly changing
The most important function that user interface designers do for their clients is the iterative extraction and refinement of the user needs and their corresponding translation in the interface.

This means that implementation is also an iterative process. Ideally a small change in the design should correspond to a small change in the implementation. Costly implementation updates leads to the temptation to lower the number of iterations with end users, leading to a user interface which incorporates less feedback from the user. 

Of major value are rapid prototyping techniques, but also implementation techniques which allow for modularity, consistent patterns, and decoupling. The single responsibility principle here is key ('only one reason to change').


## Asynchrony is tractable, but concurrency is hard
The user interface software must be structured so that it can accept input events at all times (low latency), even while executing commands. Consequently, any operations that may take a long time is problematic and must be handled in separate ways. 
At the same time, processing events triggering actions while another action is executing can lead to the well-known concurrency issues : **synchronization**, **consistency**, **deadlocks**, and **race conditions**.[^accidental-concurrency]

   [^accidental-concurrency]: Concurrency can also be by design instead of accidental. Take the case of a user interface where a user may be involved in multiple ongoing dialogs with the application, for example, in different windows. These dialogs will each need to retain state about what the user has done, and will also interact with each other. 

## User interface must handle the expected and the unexpected gracefully
Naturally, all software has robustness requirements. However, the software that handles the users’ inputs has especially stringent requirements because all inputs must be gracefully handled. Whereas a programmer might define the interface to an internal procedure to only work when passed a certain type of value, the user interface **must always accept any possible input, and continue to operate**.

Furthermore, unlike internal routines that might abort to a debugger when an erroneous input is discovered, user interface software must respond with a helpful error message, and allow the user to start over or repair the error and continue. To make the task even more difficult, user interfaces should allow the user to abort and undo operations. Therefore, the programmer should implement most actions in a way that will allow them to be aborted while executing and reversed after completion.


# The functional reactive programming pattern matches well the reactive nature of the system

A reactive system is described as the sequence of its reactions to inputs, that is a relation `(re)action = f(event)`, where `event` is taken from a set of events that the GUI is responsive to, and `action` is the associated reaction intended by the user/actor who triggered the event.

A functional reactive program which uses streams to abstract out asynchrony, describes the behaviour of the reactive system as `actions = f(events)` where :

- `events` is a (push)stream (i.e. a possibly unbounded sequence of data) of incoming events that the GUI responds to,
- `actions` a (push)stream of the corresponding reactions
- `f` is a pure function

For reactive systems which can be specified by their set of traces over the space of expected events,  i.e. `{(events, actions) | events = [event | Events]}`, the functional reactive paradigm allow to check  the correct behaviour of a reactive system for a given pair `(events, actions)`, by simply simulating the events sequence, and checking that the `actions` stream conforms to the specified trace.

For practical purposes, the set of traces being generally infinite, gray-box testing techniques can be used to reduce considerably the set of traces under test.

## ... but communicate poorly the user interface design
However, the functional reactive programming with streams approach suffers from two key issues:

- linear, one-way dataflows are expressed easily through combining higher-order stream operators (`map`, `flatMap`), simple control flow is made possible by specific operators (`filter`, `switch`, `fold`), complex control flow often requires ad-hoc solutions (jumping, interrupts, conditional branching, looping, etc.)
- streams operators are generally pure functions, hence any desired state must be passed explicitly throughout all the relevant part of the operator chain, and changes to that state must be propagated explicitly at a given point of the operator chain

In short, in the case of wireframe flows featuring complex control flow, the design cannot be easily and automatically reconstructed from the reactive implementation, as the graph flow cannot be easily separated from other implementation concerns (state passing and manipulation, stream breakdown and wiring, etc.).

The loss in readability is compounded by a lower maintainability : a small change in the control flow can lead to mistakes in identifying the impacted section of the code, or modifying a comparatively large portion of the code, all of which increases the likelihood of errors.

The ideal implementation which supports well an iterative design process is to associate a small implementation cost to a small change in design, and minimize the risks of errors while doing so (or to sound like a mathematician, the ideal implementation is a continuous function of design).

# Extended state machines are great to specify control-driven reactive systems

## Quid est
A finite state machine (FSM) is a machine specified by a finite set of conditions of existence (called states) and a likewise finite set of transitions among states triggered by events. 

[//]: # (ref : Design Patterns for Embedded Systems in C: An Embedded Software Engineering Toolkit)

Finite state machines model behavior where responses to future events depend upon previous events. There is a rich body of academic literature in this field, but a useful working definition is straightforward. Finite state machines are computer programs that consist of:

- *Events* that the program responds to
- *States* where the program waits between events
- *Transitions* between states in response to events
- *Actions* taken during transitions

An extended state machines adds : 
- *Guards* which are predicates which enable a transition when satisfied
- *Variables* that hold values needed by actions and guards between events. The set of those variables is referred to as *model*.

The events that drive finite state machines can be external to the computer, originating from a keyboard, mouse, timer, or network activity, or they can be internal to the computer, originating from other parts of the application program, or other applications.

## From event-action paradigm to event-state-action paradigm
We already mentioned that a GUI follows an event-action paradigm. The user initiates events by interacting with the user interface, and those events are meant to produce the corresponding actions intended by the designer of the user interface. In the simplest case, we have `action = f(event)`, and action depends only of the event.

In practice, this is not always the case. The action to be performed often depends not only the triggering event but on the history of events and actions which have taken place before ; or on the context in which the event takes place. For instance:

 - a toggle button click can have two actions associated, according to its current state
 - in a cd player, the play button triggers `close the cd tray and play`, if the tray is opened, `play` if the cd player is not playing or is paused, `pause` if the cd player is currently playing
 - in a video game AI, a game agent might have a state `Patrol` wherein it wanders the map looking for enemies. Once it detects an enemy, it transitions into the `Attack` state. If the target starts taking shots at our agent, it might momentarily transition into the `TakeCover` state (a "blip") before transitioning back to `Attack`
 - A large number of enterprise applications are workflow-driven systems in which documents/files/processes transition from state to state

What these have in common is that the same event is associated to different actions depending on the context in which the event occurs. We can then rewrite our equation as `action = f(event, context)` where context modelizes somehow the relevant and necessary contextual data. In the case where we can discriminate discrete logical branching points which determine the triggered action (`isToggled`, or `carriesWeapon`, etc.), we can write this equation `(action_n+1, model_n+1) = f(event_n, state_n, model_n, transitions)`, where :

- `f` is a pure function (to have `f` be a pure function, we had to expose a `model` variable as `f` computes an action but ALSO produces updated contextual data),
- `state` is to be understood in the state machine sense (`isToggled` etc., we will call that `control state`, or sometimes `qualitative state`),
 - `model` is the contextual data necessary to parameterize the action to be triggered (we will call that `quantitative state` or simply just `model` - quite the polysemic term, but keep in mind that this is whatever extra information you need to write your reactive function as a pure function).
- `transitions` is an object which contains all transition data on the aforementioned logical branching points (origin state, target state, event trigger, guards, output action), i.e. the encoded control flow of the program

Written with streams, the equation becomes `actions = f(events, states, initialModel, initialEvent, transitions)`, where :

- `f` is a pure function,
- `transitions` is an object which contains all transition data (origin state, target state, event trigger, guards, output action), i.e. the encoded control flow of the program
- `events` is a stream of incoming events accepted by the state machine
- `states` is an object which contains all relevant information necessary to describe control states for the state machine (name, entry actions, etc.)
- `initialModel` is the initial value of the model for the state machine (`model_0`)
- `initialEvent` is the initial event to kick-off the execution of the state machine (`event_0`). The initial state (`state_0`) is fixed by default, and a transition must exist from that default initial state and the initial event so the state machine can actually be non-trivial.

**NOTE** : the model disappears from the streams formulation, as use of the model is solely inward. We have then successfully encapsulated the state (control state and quantitative state) of our state machine.

## Benefits of an extended state machine
Let's see how extended state machines help alleviate the previously mentioned pain points of reactive systems design and implementation.

### Design, implementation, test and communication
We have seen that transitions between states hence allow to express complex control flow with a simple vocabulary : state, transitions, guards. State machines are in fact akin to domain-specific languages, where inputs are events, (reactive) sub-routines are transitions, variables are the model, assignments are model updates, branching constructs are control states and guards, the actions being the ouptut of the program.
The combination of dataflow (streams) and DSL-controlled flow allow to express a reactive design into an implementation with reasonable ease.

More importantly, the control flow is encoded in a regular object which can be automatically parsed in many ways of interest.

Among key examples, the state machine definition (`:: Record {transitions, eventNames, states, initialModel, initialEvent}`) can be :

- used by `f` to compute the actions from the events, i.e to produce an executable version of the state machine
- automatically parsed into a graphical representation of all or a slice of the behaviour (removing error handling flows for instance) of the state machine
- used to generate automatic tests for the state machine (note that this requires additional formalization (refinement of the DSL), more on this in a future section)

Going back to the sample application, here is an example of automatically generated flow graph, in which the error flows have been sliced out :

![(Automatically generated flow graph)](https://i.imgur.com/ioe8oi6.png "Automatically generated flow graph")

It becomes apparent that the state machine representation closely matches the wireframe flows obtained from the design phase. This shows how the systematic way to translate a reactive design into an implementation that is a state machine minimizes implementation bugs, by sticking to the design.

Design bugs themselves can be reduced (discrepancy between the produced design and the desired specification), as we mentioned before, via rapid prototyping, user feedback and iterating on the design.

Generative testing can be used to increase the test process automatization, reduce test implementation time, and increase confidence in the behaviour of the system.

Last but not least, readability refers to the ease with which a human reader can comprehend the purpose, control flow, and operation of source code. A state-machine-based DSL goes a long way in communicating the intent and meaning of a reactive program.

[//]: # (https://en.wikipedia.org/wiki/Computer_programming#Readability_of_source_code)

### Asynchrony and concurrency
All state machine formalisms, universally assume that a state machine completes processing of each event before it can start processing the next event. This model of execution is called run to completion, or RTC.
In the RTC model, the system processes events in discrete, indivisible RTC steps. New incoming events cannot interrupt the processing of the current event and must be stored (typically in an event queue) until the state machine becomes idle again. The RTC model also gets around the conceptual problem of processing actions associated with transitions, where the state machine is not in a well-defined state(is between two states) for the duration of the action. During event processing, the system is unresponsive (unobservable), so the ill-defined state during that time has no practical significance.

These semantics completely avoid any internal concurrency issues within a single state machine. This eliminates a hard-to-deal-with class of bugs.

Note : The proposed implementation at this moment does not queue events. Hence, events which occurs while an action is being executed, i.e. in between states will be ignored.

[//]: # (A_Crash_Course_in_UML_State_Machines (Quantum Leaps))


### Behaviour with respect to incremental changes in design
As we discussed before, a reactive system whose behaviour is encoded in a state machine definition can be executed' by a function `f` such that `actions = f(events, stateMachineDefinition)` where`stateMachineDefinition` is of type `Record {transitions, eventNames, states, initialModel, initialEvent}`.

incremental changes in the design are then translated into changes in events, states, model, and transitions. 

#### Transitions changes
If we suppose that the incremental change does not affect the model datatype and the set of control states, then that change can be expressed as a modification of transitions, i.e. origin-target mapping, or guards. The key point is that only an easily identifiable subset of the implementation is changing. Because the change is incremental, that subset is small. Because that subset is small, the surface area to re-test is also small, and the corresponding impact on implementation is small and contained.

#### Control state changes
If the incremental change in design results in a change in the set of control states, then the corresponding change in implementation cannot often be considered small. Removing a control state, for example, means removing all transitions to and from that control state, and the associated guards. That is a lot of meaning which disappears! This puts the onus on the state machine designer to come up with a set of control states such that incremental design change does not result in a change in control states. This may be achieved by domain-specific knowledge, and anticipation of the design changes.
Conversely, adding a control state leads to evaluate the possibility of transitions from any previously existing control states to the new control states. The complexity of that is obviously linked to the number of control states. Hence if that number of control states is small, then the impact from adding a new control state is likely to be small.

#### Model changes
Incremental design changes which result in changes in the model (for example adding a property to the model) are tricky, as the worse case require touching all model updates functions, guards and entry/exit actions and the retesting of the whole reactive system. However, in practice, in many cases, changes in the existing implementation can be small and a significant portion of the existing code can be reused.

#### Multiple type of changes
One can argue that incremental design changes which affect the whole state (control state and model) are not incremental. They often reflect either a poor state machine design (which does not stick closely enough to the reactive system design) or a significant change in the reactive system behaviour. 

#### Conclusion
Those issues are naturally compounded by the number of states and transitions of the state machines, i.e. the complexity of the control flow that is implemented. 

I however empirically found that carefully designing in a context of low-complexity control flow (around 5 states, and 20 transitions as my personal rule of thumb) generally results in a small change in reactive system design being corresponded to a small change in implementation. 

The point by and large here, is that when reactive systems are **specified** as state machines (and such is the case of the presented wireframe flows, and of business processes' user interface in general), a state machine implementation obviously may have nicer properties than alternative implementations. Because in the end, one of the best things one can do for maintainability is to keep a strong correspondence between the specifications and the code.

### Robustness
Robustness is the ability of a computer system to cope with errors during execution and cope with erroneous input. 

[//]: # (https://en.wikipedia.org/wiki/Robustness_(computer_science) This can hold a long comment

#### Handling errors during execution
Error handling is the poor cousin of programming. Programmers often focus on the main path of their program, because :
- error handling is precisely a disruption of the program control flow that is pretty hard to incorporate while keeping the program readable. 
- errors when they occur often do not have access to the necessary contextual data to take a good decision about their handling. That contextual data is dispersed in miscellaneous parts of the program and often cannot be gathered easily (relevant variables not in closure, unexploitable stack traces, etc.).

With state machines, errors related to executed actions (exceptions or returned error codes) can be included in the state machine definition as accepted events and associated to an (error) transition. This allows the system to return to a stable state in case of errors. The occurrence of an error while in a given control state also associate valuable context to an error (the control state but also the quantitative state), which facilitates error recovery. The same action returning error can lead to differentiated treatments, according to where (control state) it occurs.

For instance, in the sample application's implementation, errors occurring while saving the volunteer form data leads to a transition back to the origin state, and an update of the model which encodes the display of a control-state-specific message error in the user interface).

#### Erroneous inputs
State machines resists well to erroneous, invalid or unexpected inputs due to the following properties:

- Events which are not specified for a given state are not processed when in that state
- Transitions are deterministic[^non-deterministic-possible], hence the system is always in a predictable and expected state, independently of its inputs

  [^non-deterministic-possible]: In the present context they are, it is however possible to define non-deterministic state machines.
  
# Extended finite state machine library

We propose a state machine library which features :

- streams to represent a possibly infinite sequence of data which can be obtained asynchronously
- an extended finite state machine with :
    - transitions associated to asynchronous actions with run-to-completion semantics
	- state entry actions associated to dataflow components
- state machine component is a dataflow component following `cyclejs` conventions

With this library, it is possible to orchestrate a sequence of screens according to the control logic enclosed in the state machine. The implementation of each screen takes the form of a `cyclejs` dataflow component which have, access to the state machine model; a predefined interface to the external world; and can pass actions back to the external world (for instance an action interpreter in charge of executing the actions).
This makes this library a good choice to implement wireframe flows such as the ones included for the sample application.

We will make all these assertions more clear by :

- describing the `cyclejs` approach to reactive programming, and the associated terminology
- presenting the APIs

## Reactive programming the `cyclejs` way

We have seen previously how `actions` can be related to `events` via a pure function. `cyclejs` follows a similar approach. But first some terminology :

- A **dataflow component** is a **function** which takes as only input an object, and returns another object. The input object must allow to connect and listen to event sources of interest, the output object is a representation of the actions that needs to be processed by the action interpreter. 
- In the context of `cyclejs`, the output object is a map (action type -> stream of action data). Its type is called `Sinks` (`:: HashMap ActionName (Stream ActionData)`)
- In the context of `cyclejs`, the input object shape can vary, but invariably offers an interface to listen on specific events. Its type is called `Sources`.

So we have `actions = f(sources)`, where `f` is generally not a pure function, as the mechanics of event subscriptions may feature effectful operations (read effects or else).
However :
-  the `cyclejs` dataflow component formulation is sufficiently close from the purely functional reactive `actions = f(events)` to be useful in practical cases.
- the presence of a polymorphic `sources` object and read effects can be worked around at testing time by the usual techniques : mocking, stubbing, etc.
- `cyclejs` comes bundled with mocking facilities, and a few action interpreters, to effectively test and run the implemented reactive application

We will express our state machine component as a `cyclejs` dataflow component, with an extra `settings` parameter for easy parameterization : `Component :: Sources -> Settings -> Sinks`

## APIs
The APIs is composed of the state machine factory function, and a few utilities.

### `makeFsm :: Events -> Transitions -> EntryComponents -> FsmSettings -> Component`

Creates and returns a state machine component whose behaviour is defined by :

- the events handled by the state machines
- the control states of the state machine 
- the associated components to be started upon entry in the control states
- the transitions between states
- the state machine settings

It generally goes like this:

- an initial event is fired upon initialization of the state machine which leads to an initial state
- the state machine changes state as a function of the incoming events it is configured to pay attention to, and the guards and transitions defined for the current state it is in
- on entering a new state, the corresponding entry dataflow component is started
	- those entry dataflow components can have their private state, as usual, that no other component will have access to
	- however, entry dataflow components can only have a read access to their enclosing context (i.e. the model associated to the state machine)
	- entry dataflow components are not aware of and do not control their lifecycle. That is done by the state machine component
- entry dataflow components are terminated when a transition is started (**TO DO : CHECK - or when a transition is completed?**)

Going back to the volunteer application, the example implementation uses a state machine which sequences the application into 5 steps (states) to which correspond 5 screens (entry dataflow components), and controls the transition from one state to another according to configured application-specific rules.

### Events
An event has a name and is mapped to an event factory. An event factory is the function which actually creates the stream of event objects for that event name, from the `sources` and `settings` passed in arguments to the state machine data flow component. `settings` can hence be used to parameterize to some extent the event stream creation.

Event names can be any valid identifier, except the reserved identifiers used for the good behaviour of the state machine (cf. contracts section).

#### Types
- `Events :: (HashMap EventName Event) | {}`
- `Event :: Sources -> Settings -> Stream EventData`
- `EventName :: String`
- `EventData :: *`

#### Contracts
- The `EV_INIT` event is reserved and **MUST NOT** be used in user-defined event configuration (FOOTNOTE : the corresponding event name string is found in the declaration of `INIT_EVENT_NAME`)
- For the `EV_INIT` event, there **MUST** be defined a transition 

#### Description
Events to be processed by the state machine are defined through event factories. The `events` parameter maps an event name to an event factory which once executed will return a stream of events associated to that event name.

The event factory receives the same `sources` and `settings` arguments than the state machine component, hence is injected the same dependencies than the state machine component.

**NOTE** : the stream of events returned by the factory **MAY** have an immediate starting event. However, there should only ever be one of such (`FETCH` event for instance), as all starting events for all stream of events will be executed in order of definition, right after the reserved initial event - that might not be the desired order. Also, the library does not offer the possibility for now to have immediate events triggered automatically by entering a state (no transient state, no immediate preemption).


### Transitions
The `Transitions` data structure is the most complex object and encodes most of the behaviour of the state machine. It is a hashmap whose each entry encodes the logic for a given transition between an origin state and a target state.

Every such entry has a name and is mapping to an object holding :

- the origin state for the transition
- the event that triggers the transition
- a data structure which contains the set of possible target states and the conditions necessary to select a target state to transition to.

In that data structure, for each entry, we have :

- the guard that applies to the triggering event.
- an action request to execute prior to transitioning to a target state (optional)
- a data structure which aims at defining the logic to apply according to the execution of the action request. This includes 
	- a guard applied to the action response
	- the target state to transition to if the guard is fulfilled
	- a model update function which gives the updates to apply to the state machine encapsulated model

**Event guards** : Predicate function which takes the event data for the triggering event, the current value of the state machine's encapsulated model, and returns a boolean which enables or invalidates the associated transition.

If no event guards are satisfied, then the state machine does not transition and remains in the same state.

**Action guards** : Predicate function which takes the action response for the triggered action request, the current value of the state machine's encapsulated model, and returns a boolean which enables or invalidates the associated transition.

Once an action request has been emitted, the state machine waits for a response. Once an action response is received, the state machine must transition to some state, otherwise it would remain stuck forever in an intermediary state. This means that at least one action guard must be satisfied, otherwise an exception will be raised. 

Action guards allow to have a treatment differentiated per the action response. A common use case is to deal with action requests which have failed. One guard can test for correct execution of the action request, and associate with a success state, another guard can test for the opposite case, and associate with an error state. 

**Model update functions** : Model update functions compute the set of update operations to perform on the model, from the triggered event data, the executed action response (if any), the current value of the model, and the `settings` passed through the state machine dataflow component.

As such, model update functions do not modify the model, but rather computes a list of update operations to perform. These are the typical CRUD operations and take inspiration from `JSON Patch` (RFC 6902) which is a format for describing changes to a JSON document. It is hence considered safer to have a model which is a valid JSON document (i.e. avoid functions and other constructs which are not JSON-serializable). This is not a hard requirement at the present, but it might be in future versions.

The rationale for this is two-pronged:
- we treat the encapsulated model as an externally inmutable object
- we can store (for debugging or else) the update operations, and replay them at will to rewind to a previous version of the model (**not implemented yet**).

**Action requests** : Action requests are specified via a data structure containing the driver responsible for interpreting the action request, and a request factory function which takes the triggered event data and the current value of the state machine model to produce the actual request. That request has three properties: `context`, `command`, `payload`. The `context` property serves to parameterize/refine the `command`, and the `payload` holds parameters for the command. 

**NOTE** : This is an arbitrary choice, we could have included `context` in the `payload`. We chose to extract it out to make the refinement meaning more apparent. For instance, we have an `update` command in the sample application, with a `userApplication` context, which means the command is `update userApplication`, and the parameters are `payload`.

**Action responses** : The state machine will be reading responses for requests on the same source name than the driver name. That is if the driver for the request is `domainAction$`, then the response will be expected on `sources.domainAction$`. That response has a specific form : it must include the original request object, so the response can be reconciliated with its originating request. The rest of the properties of the request is arbitrarily set to `response` and `err` to indicate success or failure of the request.

**NOTE** : In the current version of the library, an action request **MUST** be associated to a response. The state machine will **WAIT** for that response, hence it will block if no such response occurs.

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
- Any state defined in the `transitions` parameter, **MUST** be corresponded with an entry in the `stateEntryComponents` parameter.
- if a target state can be the same as an origin state, the `re_entry` property **MUST**be configured
- if a target state differs from an origin state, the `re_entry` property **MUST NOT** be configured
- A transition **MAY** have an action response guard
- A transition **MAY** have an event guard
- If a transition between two states have one or several action response guards, then for any incoming events, **at least ONE** of the guards **MUST** pass.
- (events and actions) guard predicates **MUST** be pure functions - or in a more relaxed manner **MAY** have side-effects which do not affect the evaluation of other guards for the same event
- Run-To-Completion (RTC) semantics : a state machine completes processing of each event before it can start processing the next event
	- Additional events occurring while the state machine is busy processing an event are dropped
- FSM configured functions **MUST NOT** modify the model object parameter that they receive
- FSM configured functions **MUST** be synchronous and immediately compute and return their value
- FSM configured functions **MAY** throw, and that results in the state machine re-throwing the
exception
- if `action_request` property has no driver associated, then the request field **MUST** be null (**implemented??**)
- if `action_request` property is none then `transition_evaluation.action_guard` **MUST** be Null  (**implemented??**)
- an action request **MUST** have an action response associated. Otherwise, the state machine will block without end, waiting for a response.
- if an action request features a driver name, that driver name **MUST** be found in the sources.
Otherwise, the state machine will block without end, waiting for a response. (**implemented??**)

#### Description
- The state machine starts in the `S_INIT` state, and automatically fires the special reserved `EV_INIT` event. From then onwards, the state machine behavior is determined by its user-defined configuration
- Given that the state machine is in a origin state, and given an incoming event :
  - when that incoming event does not have a configured transition associated, a warning is issued and the event is discarded. That is the case for not configured user-event but also for responses to requests (arriving for instance while the state machine is not expecting them).
  - when that incoming event has a configured transition associated, then :
     - when there are no event guards, the program behaves as if there was an event guard which is always satisfied (`always(true)` predicate)
     - when there are events guards, they are evaluated in order of declaration (i.e. array order)
         - when no event guards are satisfied, a warning is issued, and the incoming event is discarded
         - when an event guard is satisfied :
             - when there is an action request, that action request is sent, and the statemachine **WAITS** for a response
                 - when a user event arrives while waiting, a warning is issued, and the user event is discarded
                 - when a response arrives AND matches the request sent, then
                     - when there is no action guard, the program behaves as if there was an action guard which is always satisfied (`always(true)` predicate)
                     - the action guards are executed in order of declaration (i.e. array order)
                         - if no action guard is satisfied an exception is raised!
                         - if an action guard is satisfied, the state machine's model is updated and transitions to the configured target state
                 - when a response arrives AND DOES NOT match the request sent, then a warning is issued and the response is discarded
               - when there is no action request, the state machine's model is updated and transitions to the configured target state

### States
Control states are associated to state entry dataflow component factories. Those are functions which takes the current value of the encapsulated model of the state machine and return a regular dataflow component, which can be further parameterized by a `settings` parameter (optional).
Upon entry of a state, the mapped dataflow component will be executed, and its sinks (i.e. actions) will be connected to the sinks of the same name of the state machine dataflow component.

**entry component initialization** : performed when a target state has been evaluated and the target state is entered.

**entry component termination** : performed when an action request is emitted, and the control state is left. Note that while the action is being executed, the state machine is in limbo, it is neither in the origin state, nor in the target state.

**state re-entry**: when the target state is the origin state, it is possible to configure whether the state entry component must be re-initialized (`re_entry : true`) or left as is (`re_entry : false`). I haven't found a case where one would not want to re-execute the entry dataflow component (specially given that it is terminated on leaving the state), but the configuration option will remain there for some time, should that case appear.

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

**NOTE OF CAUTION** :: an state machine configured with an event guard such that the init event fails will remain in the initial state : the init event will not be repeated, hence the state machine will never transition.


#### Description
The states that the state machines can navigate to are necessarily the keys of the `stateEntryComponents` parameters. To each such state/key, a component is associated. That component will be initialized upon entering the state, and stopped upon exiting that state.

It should be noted that depending on the configuration of the state machine, in particular in line with the `re_entry` configuration parameter, the component may or may not be re-initialized in the special case of a state machine exiting one state and re-entering the same state.

The returned component is taking the same `sources` and `settings` parameters than the state machine component, hence is injected the same dependencies than the state machine component.

Its `sinks` output is merged with the state machine component output and should then logically be passed downstream to the sinks interpreter.


**NOTE**: to prevent unwanted modification of the internal state machine model, the `model` parameter passed to all configured state machines' functions is a clone of the internal model. This might have some effect on performance, we might consider relaxing this constraint in future versions if need be.

**NOTE**: *NOT IMPLEMENTED* :
The state machine keeps a journal of the modification of its model (history of update operations together with the transitions taken) for debugging purposes or else.


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
- `init_event_data` : data to be included in the initial event upon initialization of the state machine
- `sinkNames` : names of the sink which will be output by the state machine. This is parameter is of paramount importance, as no sinks which are not included here will be output and processed by the state machine.
- `debug` : if set to `true`, automatically adds logging and tracing aspects to all functions used in the state machine configuration. This includes, event factory, event streams, actions, actions guards, event guards, and state entry components. 

**NOTE** : the debug is best used with functions which have meaningful names (i.e. avoid anonymous functions). This gives for more readable logs.


# Sample application implementation - first iteration
**TODO include graph for both iterations, and then gather all second iterations into their own section, starting with the graph first** 
## Modelization
The events to process are pretty obvious from the wireframe flows (button clicks, etc.).
We will match each screen with a control state of our state machine. That makes 5 control states. To each of this control state, we will have a dataflow component whose only action request will be to update the DOM with that screen content. 
The quantitative state will have to hold all necessary data for each screen to draw itself, and the guards and actions to describe their logic. This includes :

- all field contents for each screen
- the step (`progress indicator` region) of the application process
- an error message field to give feedback to the user if something went wrong
- validation messages representing the hints related to the content for each field

Transitions and guards are partly given by the wireframe flows. They will have to be completed so there is no logic hole in the design (i.e. a logic branch which is not considered).


## Events
The events processed by the state machine are defined as follows :

```javascript
export const events = {
  [FETCH_EV]: fetchUserApplicationModelData,
  [ABOUT_CONTINUE]: aboutContinueEventFactory,
  [QUESTION_CONTINUE]: questionContinueEventFactory,
  [TEAM_CLICKED]: teamClickedEventFactory,
  [SKIP_TEAM_CLICKED]: skipTeamClickedEventFactory,
  [JOIN_OR_UNJOIN_TEAM_CLICKED]: joinTeamClickedEventFactory,
  [BACK_TEAM_CLICKED]: backTeamClickedEventFactory,
  [TEAM_CONTINUE]: teamContinueEventFactory,
  [CHANGE_ABOUT]: changeAboutEventFactory,
  [CHANGE_QUESTION]: changeQuestionEventFactory,
  [CHANGE_TEAMS]: changeTeamsEventFactory,
  [APPLICATION_COMPLETED]: applicationCompletedEventFactory
};
```

As an example, here is the fetch event factory :

```javascript
export function fetchUserApplicationModelData(sources: any, settings: any) {
  const { user$ } = sources;
  const { opportunityKey, userKey } = settings;
  const userApp$ = fetchUserApplicationData(sources, opportunityKey, userKey);
  const teams$ = sources.query$.query(TEAMS, {});
  const opportunities$: Stream<Opportunity> = sources.query$.query(OPPORTUNITY, { opportunityKey });

  // NOTE : combineArray will produce its first value when all its dependent streams have
  // produced their first value. Hence this is equivalent to a zip for the first value, which
  // is the only one we need anyways (there is no zipArray in most)
  return combineArray<FirebaseUserChange, Opportunity | null, UserApplication | null, Teams | null, any>(
    (user, opportunity, userApplication, teams) =>
      ({
        user,
        opportunity,
        userApplication,
        teams,
        errorMessage: null,
        validationMessages: {}
      }),
    [user$, opportunities$, userApp$, teams$]
  )
    .take(1)
}
```

And here is the factory for the click on the `continue` button at the `About` step.

```javascript
export function aboutContinueEventFactory(sources: any, settings: any) {
  return sources.dom.select('button.c-application__submit--about').events('click')
    .tap(preventDefault)
    .map((x: any) => ({formData : getAboutFormData() }))
}
```


## Transitions

### Initialization
To jump start the state machine, we will fetch the stored application from the server via `FETCH` event, which will be immediately emitted on state machine initialization (after the initial event is emitted). This means that the state machine is initialized with dummy/empty initial model (it will be fetched) and initial event data (unused). 

```javascript
  T_INIT: {
    origin_state: INIT_STATE,
    event: INIT_EVENT_NAME,
    target_states: [
      {
        event_guard: EV_GUARD_NONE,
        re_entry: true, // necessary as INIT is both target and current state in the beginning
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: ACTION_GUARD_NONE,
            target_state: INIT_S,
            model_update: modelUpdateIdentity
          }
        ]
      }
    ]
  },
```

For the fetch event data, we determine in which step the volunteer left the application and transition to the corresponding control state. But before that, we must check if the volunteer has actually already finished its application and apply the corresponding logic. This gives us the following transitions :

```javacript
  dispatch: {
    origin_state: INIT_S,
    event: FETCH_EV,
    target_states: [
      {
        // whatever step the application is in, if the user has applied, we start with the review
        event_guard: hasApplied,
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: ACTION_GUARD_NONE,
            target_state: STATE_REVIEW,
            // Business rule
            // if the user has applied, then he starts the app process route with the review stage
            model_update: initializeModelAndStepReview
          }
        ]
      },
      {
        event_guard: isStep(STEP_ABOUT),
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: ACTION_GUARD_NONE,
            target_state: STATE_ABOUT,
            model_update: initializeModel // with event data which is read from repository
          }
        ]
      },
      {
        event_guard: isStep(STEP_QUESTION),
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: ACTION_GUARD_NONE,
            target_state: STATE_QUESTION,
            model_update: initializeModel // with event data which is read from repository
          }
        ]
      },
      {
        event_guard: isStep(STEP_TEAMS),
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: ACTION_GUARD_NONE,
            target_state: STATE_TEAMS,
            model_update: initializeModel // with event data which is read from repository
          }
        ]
      },
      {
        event_guard: isStep(STEP_REVIEW),
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: ACTION_GUARD_NONE,
            target_state: STATE_REVIEW,
            model_update: initializeModel // with event data which is read from repository
          }
        ]
      }
    ]
  },
```

### Transition away from `About` screen
We only have one event to consider here : the click on the `Continue` button. The application logic as specified is :

- if the user had already reached the review step, then click on `Continue` must : 
  - update the user application remotely with the newly entered form data
  - send the volunteer to the review step
-  otherwise it must : 
  - update the user application remotely with the newly entered form data
  - send the volunteer to the `Question` step

The corresponding transitions are defined here : 

```javascript
  fromAboutScreen: {
    origin_state: STATE_ABOUT,
    event: ABOUT_CONTINUE,
    target_states: [
      {
        // Case form has NOT reached the review stage of the app
        event_guard: complement(hasReachedReviewStep),
        action_request: {
          driver: 'domainAction$',
          request: makeRequestToUpdateUserApplication
        },
        transition_evaluation: makeDefaultActionResponseProcessing({
          success: {
            target_state: STATE_QUESTION,
            model_update: updateModelWithAboutDataAndStepQuestion
          },
          error: {
            target_state: STATE_ABOUT,
            model_update: updateModelWithStepAndError(updateModelWithAboutData, STEP_ABOUT)
          }
        })
      },
      {
        // Case form has reached the review stage of the app
        event_guard: T,
        re_entry: true,
        action_request: {
          driver: 'domainAction$',
          request: makeRequestToUpdateUserApplication
        },
        transition_evaluation: makeDefaultActionResponseProcessing({
          success: {
            target_state: STATE_REVIEW,
            model_update: updateModelWithAboutDataAndStepReview
          },
          error: {
            target_state: STATE_ABOUT,
            model_update: updateModelWithStepAndError(updateModelWithAboutData, STEP_ABOUT)
          }
        })
      },
    ]
  },
```

For information, here are some examples of model update functions :

```
export const aboutYouFields = ['superPower'];
export const personalFields = ['birthday', 'phone', 'preferredName', 'zipCode', 'legalName'];
export const questionFields = ['answer'];

export const updateModelWithAboutDataAndStepQuestion = chainModelUpdates([
  updateModelWithAboutData,
  updateModelWithEmptyErrorMessages,
  updateModelWithStepOnly(STEP_QUESTION)
]);

export function updateModelWithAboutData(model: FSM_Model, eventData: EventData,actionResponse: DomainActionResponse) {
  const formData = eventData.formData;

  return flatten([
    toJsonPatch('/userApplication/about/aboutYou')(pick(aboutYouFields, formData)),
    toJsonPatch('/userApplication/about/personal')(pick(personalFields, formData)),
  ])
}

....etc....
```

and example of action request :

```
///////
// Action requests
export function makeRequestToUpdateUserApplication(model: UserApplicationModelNotNull, eventData: any) {
  const formData = eventData.formData;
  const { userApplication } = model;
  const newUserApplication  = getUserApplicationUpdates(formData, userApplication);
 
  return {
    context: USER_APPLICATION,
    command: UPDATE,
    payload: newUserApplication
  }
}
```

### Other transitions
The full implementation can be found here **TODO : include the repo but without most and with cycle/rxjs - maybe use an old version of cycle?**

## State entry components

They will mainly serve to display the view derived from the value of the `model` parameter. For instance, the entry component for the state `About` is :

```javascript
export const entryComponents = {
...
[STATE_ABOUT]: function showViewStateAbout(model: UserApplicationModel) {
    return flip(renderComponent(STATE_ABOUT))({ model })
  },
}
...
```

with `renderComponent` being :

```javascript
function render(model: UserApplicationModelNotNull) {
  const { opportunity, userApplication, errorMessage } = model;
  const { description } = opportunity;
  const { about, questions, teams, progress } = userApplication;
  const { step, hasApplied, latestTeamIndex } = progress;

  return div('#page', [
    div('.c-application', [
      div('.c-application__header', [
        div('.c-application__opportunity-title', description),
        div('.c-application__opportunity-icon', 'icon'),
        div('.c-application__opportunity-location', 'location'),
        div('.c-application__opportunity-date', 'date'),
      ]),
      div('.c-application__title', `Complete your application for ${description}`),
      div('.c-application__progress-bar', flatten([renderApplicationProcessTabs(step)])),
      form('.c-application__form', flatten([renderApplicationProcessStep(step, model)])),
      errorMessage
        ? div('.c-application__error', `An error occurred : ${errorMessage}`)
        : div('.c-application__error', '')
    ]),
  ]);
}

function _renderComponent(state: State, sources: any, settings: any) {
  void sources;
  const model: UserApplicationModelNotNull = settings.model;
  console.info(`entering ${state}`, model);

  return {
    dom: just(render(model))
  }
}
export const renderComponent = curry(_renderComponent);
```

# Sample application implementation - second iteration

## Modelization
We add the following fields to the model :

- validation messages representing the hints related to the content for each field

## Events
We have to add the input form data validation functionalities. Control flow is decided at the guard level, and will basically include two branches : go to next step if fields valid ; remain in same step if one field is invalid. 
Validating involves first retrieving the form data, and passing them through some validation function. 
Retrieving form data will be performed in the event factory as it is a read effect, and we want to keep guards as pure functions.
We choose here to have the validation function return `true` if a field passed validation, and a string representing the error in case the field does not pass validation. The validation will also be performed in the event factory, as we want to keep guards are single-concern functions. Furthermore, including the validation at the guard level would imply that the validation is run several times (for each guard), which is a source of inefficiency.

Applying these ideas to the `events` object, leads, for instance, to this factory for the click on the `continue` button at the `About` step becomes as follows:

```javascript
export function aboutContinueEventFactory(sources: any, settings: any) {
  return sources.dom.select('button.c-application__submit--about').events('click')
    .tap(preventDefault)
    .map((x: any) => {
      const formData = getAboutFormData();

      return {
        formData,
        validationData: validateScreenFields(aboutScreenFieldValidationSpecs, formData)
      }
    })
}
```

## Transisition away from `About` screen
As before, we only have one event to consider here : the click on the `Continue` button. The application logic as now specified includes another branching level and becomes (the modifications vs. former specifications are in bold):

- **if the form data is valid then :**
	- if the user had already reached the review step, then click on `Continue` must :
		- update the user application remotely with the newly entered form data
		- send the volunteer to the review step
	- otherwise it must :
		- update the user application remotely with the newly entered form data
		- send the volunteer to the `Question` step
- **if the form data was invalid then :**
	- **the screen must show some error messages and visual feedback**

We hence now have three branches in our control flow (vs. two previously) and the corresponding updated transitions are defined here : 

```javascript
  fromAboutScreen: {
    origin_state: STATE_ABOUT,
    event: ABOUT_CONTINUE,
    target_states: [
      {
        // Case form has only valid fields AND has NOT reached the review stage of the app
        event_guard: both(isFormValid, complement(hasReachedReviewStep)),
        action_request: {
          driver: 'domainAction$',
          request: makeRequestToUpdateUserApplication
        },
        transition_evaluation: makeDefaultActionResponseProcessing({
          success: {
            target_state: STATE_QUESTION,
            model_update: updateModelWithAboutDataAndStepQuestion
          },
          error: {
            target_state: STATE_ABOUT,
            model_update: updateModelWithStepAndError(updateModelWithAboutData, STEP_ABOUT)
          }
        })
      },
      {
        // Case form has only valid fields AND has reached the review stage of the app
        event_guard: both(isFormValid, hasReachedReviewStep),
        re_entry: true,
        action_request: {
          driver: 'domainAction$',
          request: makeRequestToUpdateUserApplication
        },
        transition_evaluation: makeDefaultActionResponseProcessing({
          success: {
            target_state: STATE_REVIEW,
            model_update: updateModelWithAboutDataAndStepReview
          },
          error: {
            target_state: STATE_ABOUT,
            model_update: updateModelWithStepAndError(updateModelWithAboutData, STEP_ABOUT)
          }
        })
      },
      {
        // Case form has invalid fields
        event_guard: T,
        re_entry: true,
        action_request: ACTION_REQUEST_NONE,
        transition_evaluation: [
          {
            action_guard: T,
            target_state: STATE_ABOUT,
            // keep model in sync with repository
            model_update: updateModelWithAboutValidationMessages
          },
        ]
      }
    ]
  },
```

We also have to update the model update functions to reflect the changes in the model (which now includes validation messages). A change in model means revisiting all existing model update functions and possibly create new model update functions. 
Here `updateModelWithAboutValidationMessages` is a new cretaed function. Existing model update functions will be updated to reflect the rule that validation messages are empty when the fields are valid. For instance, the function `updateModelWithAboutDataAndStepQuestion` adds `updateModelWithEmptyErrorMessages` to its updates and becomes :

```javascript
export const updateModelWithAboutDataAndStepQuestion = chainModelUpdates([
  updateModelWithAboutData,
  updateModelWithEmptyErrorMessages,
  updateModelWithStepOnly(STEP_QUESTION)
]);

```

There is no further updates to the actions, and action guards. 

### Other transitions
The full implementation can be found here **TODO : include the repo but without most and with cycle/rxjs - maybe use an old version of cycle?**

## State entry components

State entry components have to be updated to display visually the validation messages passed through the `model` parameter.

## Conclusion

In summary, the seemingly simple changes in specifications necessitated :

- changes in the model
	- reviewing all model update functions to reflect the new model dependencies. Here we added a new field to the model, so changes in model update functions were obvious and minimal.
- changes in event factories
	- event now includes new data which are necessary to compute the validation rules
- changes in the control flow
	- no new control state
	- new transition logic implemented through update of event guards
- changes in the state entry component
	- updating the view rendering model to display the validation messages

We have seen that :
- changes in the specifications are easily translated into changes in the implementation
	- most functions are pure functions one single concern, hence it is easy to decide whether to modify and how to modify such functions
	- event factories have two concerns : capturing the source event, and producing the event data (producing in the way read effects). Given that the source event does not change, changes in the event factories were minimal
- changes in the `model` require reviewing all functions taking `model` as a parameter (event, guards, action requests, entry components). However, because not all functions do not use all parts of the model, we are able to bring down the number of modifications performed on model-related functions.

The lesson to be learnt is that special care have to be given to how the `model` is defined, as it is the key source of complexity left unabridged :
- writing the model in a way that all functions use all parts of the model gives the worse case for maintainability
- the model, by nature, gathers several concerns to be transmitted to different parts of the state machine component. It is good practice to isolate early cross-cutting concerns, and separate the concerns which are orthogonal into different properties. This would help ensure that a modification of the model structure have lower impact on the implementation.

# Known limitations 
## You can still write an unmaintainable *spaghetti* implementation
The need for guards in the extended state machine formalism is the immediate consequence of adding memory (extended state variables) to the state machine formalism. Used sparingly, extended state variables and guards make up an incredibly powerful mechanism that can immensely simplify designs. But don’t let the fancy name (“guard”) fool you. When you actually code an extended state machine, the guards become the same `IF`s and `ELSE`s that you wanted to eliminate by using the state machine in the first place. Too many of them, and you’ll find yourself back in square one (“spaghetti”), where the guards effectively take over handling of all the relevant conditions in the system.

Indeed, abuse of extended state variables and guards is the primary mechanism of architectural decay in designs based on state machines. Usually, in the day-to-day battle, it seems very tempting, especially to programmers new to state machine formalism, to add yet another extended state variable and yet another guard condition (another if or an else) rather than to factor out the related behavior into a new qualitative aspect of the system—the control state. The likelihood of such an architectural decay is directly proportional to the overhead (actual or perceived) involved in adding or removing states. 

One of the main challenges in becoming an effective state machine designer is to develop a sense for which parts of the behavior should be captured as the qualitative” aspects (the “control state”) and which elements are better left as the “quantitative” aspects (extended state variables).


## State - transition topology is static
Capturing behavior as the “quantitative state” has its disadvantages and limitations, too. First, the state and transition topology in a state machine must be static and fixed at compile time, which can be too limiting and inflexible. Sure, you can easily devise state machines that would modify themselves at **runtime** (this is what often actually happens when you try to recode “stream spaghetti” as a state machine). However, this is like writing self-modifying code, which indeed was done in the early days of programming but was quickly dismissed as a generally bad idea. Consequently, “state” can capture only static aspects of the behavior that are known a priori and are unlikely to change in the future.

[//]: # (ref : Ref : A_Crash_Course_in_UML_State_Machines (Quantum Leaps)


## Does not do well with a high number of control states
While extended FSMs are an excellent tool for tackling smaller problems, it is also generally known that they tend to become unmanageable even for moderately involved systems. Due to the phenomenon known as "state explosion", the complexity of a traditional FSM tends to grow much faster than the complexity of the reactive system it describes.
The issue is not so much the number of states than the transition topology of the modelized reactive system. Some events can lead to the same action and target state, independently of the current state. This means repeating a transition as many times as there are control states, hence the exponential growth of the complexity.
This issue is considerably alleviated with the statecharts formalism (also called Hierarchical State Machines), but we chose to remain at a simpler and more accessible conceptual level of extended state machine. We will see other techniques which helps in practice keep the number of control states low.

[//]: # (http://self.gutenberg.org/articles/Hierarchical_state_machine)

## Run-to-Completion execution model can over-simplify concurrency issues 
The key advantage of RTC processing is simplicity. Its biggest disadvantage is that the responsiveness of a state machine is determined by its longest RTC step. Achieving short RTC steps can sometimes significantly complicate real-time designs. 
In a future version of the library, event queuing and convenient interruption policies will be added.

[//]: # (A_Crash_Course_in_UML_State_Machines (Quantum Leaps))

# How to
## Perform operations at initialization
The common use case is that you might want to fetch some remote data and update the internal model of the state machine with some of that.  Two options :

1. Use `INIT` event in the state machine definition 
Every state machine has a `INIT` event which is sent when the state machine is activated. It is possible to configure a transition with an action which updates the model from its result
2. Use ONE event factory which immediately emits an event (i.e. synchronously)
When a state machine is activated, event factories are immediately executed, and the state machine starts listening on events coming from those event factories. If ONE of those event factories immediately emits an event, that event will immediately be processed (after the initial `INIT` event kicking off the state machine). It is better to have only one immediate event, as if there would be several, there is no guarantee on the order with which those events would be processed, hence there is no guarantee on their effects.


# Reusability TO DROP

**TODO add Angular2 implementation**

# Roadmap
- specify event queuing, back pressure and interruption policies
- isolate out the output of the state machine (command passed through sinks)
- isolate out further the asynchronous actions to reuse a synchronous hierarchical state machine
	- input -> EHFSM -> command request => command manager
	- command manager orchestrates the command requests
		- drop command request if there is a command currently executing and not finished
		- queue command request to be executed after current command is done executing
		- abort current command execution and execute incoming command request
		- abort current command execution if it takes too long to return a response
		- this would require a controlling input (channel) linking the command manager to the EHFSM.
			- the EHFSM would hence have a BUSY state for all async. command which are pending execution
			- the BUSY state would transition on controlling input received from command manager : BUSY, ABORT -> return to state before BUSY, SUCCESS -> transition to next state, ERROR -> same thing
			- queuing events would have to be done at EHFSM level, but that is tricky...
				- if event 1 succeed, the FSM changes state so the queued events would be interpreted in the new state context
				- if event1 fails, the FSM might transition to an error state, so the queued events would be interpreted in the new error state context
				- etc. so it is tricky - best is to drop the events, but not always possible?


# References TODO

Challenges of HCI Design and Implementation, Brad A. Myers, 1994
https://www.researchgate.net/publication/220383184_Challenges_of_HCI_Design_and_Implementation

A_Crash_Course_in_UML_State_Machines (Quantum Leaps)
https://classes.soe.ucsc.edu/cmpe013/Spring11/LectureNotes/A_Crash_Course_in_UML_State_Machines.pdf

Design Patterns for Embedded Systems in C: An Embedded Software Engineering Toolkit (Bruce Powel Douglass, 2003)

Hierarchical state machine, World Heritage Encyclopedia
http://self.gutenberg.org/articles/Hierarchical_state_machine

Readability of source code, Wikipedia
https://en.wikipedia.org/wiki/Computer_programming#Readability_of_source_code

