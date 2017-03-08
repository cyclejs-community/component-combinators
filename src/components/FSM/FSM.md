# Finite state machines
A finite state machine (FSM) is a machine specified by a finite set of conditions of existence
(called states) and a likewise finite set of transitions among states triggered by events�
[Douglass 2003, chap.1]

Finite state machines model behavior where responses to future events depend upon previous events. There is a rich body of academic literature in this field (see Related topics), but a useful working definition is straightforward. Finite state machines are computer programs that consist of:
- *Events* that the program responds to
- *States* where the program waits between events
- *Transitions* between states in response to events
- *Actions* taken during transitions
- *Variables* that hold values needed by actions between events

Finite state machines are most useful in situations where behavior is driven by many different types of events, and the response to a particular event depends on the sequence of previous events. The events that drive finite state machines can be external to the computer, originating from a keyboard, mouse, timer, or network activity, or they can be internal to the computer, originating from other parts of the application program, or other applications.

States are a way to remember previous events, and transitions are a way to organize responses to future events. One of the states must be designated as the initial state. There may be a final state, but this is optional.


In the following sections, we will :

- introduce an average complexity user interface specification
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
   - button clicks (`Continue`, `Join`, `Skip`, `Change`)
 - a fetch event will be used to fetch past data from the back-end
 - event guards and action guards will be defined to implement the conditions associated to the transitions
 - the state machine model will hold :
   - persistent state, i.e. a copy of relevant data from the back-end (college information, classes information, etc.)
   - state of the user-application (which classes have been joined, answers to questions, in which step of the application the student is currently in, etc.)
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
- user interface triggers actions which are not a simple function of the triggering event
- the action logic can be modelized by using a low number of states (i.e. logical branches)

However, while the traditional FSMs are an excellent tool for tackling smaller problems, it is also generally known that they tend to become unmanageable even for moderately involved systems. Due to the phenomenon known as "state explosion", the complexity of a traditional FSM tends to grow much faster than the complexity of the reactive system it describes.
 
### Benefits of the finite state machine formalism
- it is a formalism, i.e. a **systematic** to express the actions of a reactive system as a 
function of its state. That means that it is easy to figure out that logic, even 10 months 
after the fact, once the formalism is learnt.
- self-documenting
  - the corresponding graph with its transitions from state to state can be automatically 
  generated and drawn, allowing for a clear visual representation of the state machine
  - all functions do only one thing, and are located in the same place, and are **guaranteed**
  to be executed through a knownn logic
- maintainable : adding, updating, removing actions are simple tasks, and any of these can be 
made in an independent manner which does not interfere with existing actions (other than the fact
 the new/deleted/updated action can also modify the state machine model)
- easily testable :
  - provided the state machine library is thoroughly tested, there is no need to 
test the logic any longer, only the bits (event generation, guards, model updates, etc.)
  - if really necessary, the event-to-action function specifications (i.e. tests) can be 
  automatically generated - they are exactly the definition of the state machine

## Example implementation

# API
In order to achieve a ... management of events, together with asynchronous actions, the state machine library have been built around :
- streams for management of asynchrony and time-varying behaviours
- functional (reactive) programming for reusability

## The functional reactive paradigm
a few words about streams and components and sinks and sources

## State machine component
introduce the fact that entry state are entry components in fact

### Events
### Transitions
### States

# Reusability
We presented an example using `cycle-js` as a framework. We also could have used Angular 2 with no modifications to the library. We however will have to adjust the interface.

## `Apply to colleges` application with Angular 2

# Roadmap

# References and prior work
As far as user interface is concerned, a common reference is *Constructing the user interface with statecharts*   by Ian Horrocks. A valuable ressource from the inventor of the graphical language of the statecharts is  *Modeling Reactive Systems with Statecharts: The STATEMATE Approach*  by Professor David Harel.

Why Statecharts Based Design? Why Statecharts Based Design? :
http://msdl.cs.mcgill.ca/people/hv/teaching/MSBDesign/COMP762B2003/presentations/GUIdesign.pdf
