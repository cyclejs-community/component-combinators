# Motivation

The `Pipe` component allows to execute a number of components sequentially, with the ouptuts (sinks)
 of each connected to the inputs of the next.  

This covers the case of components which do not output action sinks but intermediary sinks, 
destined to serve as inputs for components finalizing the sinks computation. 

- It allows to use the event-intent-action pattern, by isolating each concern in a single component, and 
sequentially composing them: `ComposedComponent = Pipe(Event, Intent, Action)`, where `Event` 
acts as event factory, returns sinks which are events, `Intent` aggregates events into intent 
sinks, `Action` computes the actions sinks from the intents. 
- It also covers the case of reuse of generic components, by allowing to prefix an adapter component to match interfaces : 
`AdaptedComponent = Pipe(AdHocComponentA, AdapterA, ReusableComponent, AdapterB, AdHocComponentB)
`. A simple case for instance is when it is needed to change the name of an output sink or 
input source to respect the interface of another component.

To realize the chaining, sinks returned by a component will be passed as source to the next 
component in the sequence. In the general case, one should not allow collision between source and
 sink, i.e. sink names should be different from source names - unintended behaviour linked to 
 this can be VERY HARD to debug. To cover for the unexpected case where the previously described behaviour would be desired, such behaviour should be parameterizable, albeit with a sound default.

# API

## Pipe :: PipeSettings -> [Component] -> PipedComponent
### Description
Creates a `PipedComponent` whose behaviour is parameterized via `PipeSettings`. Its second 
argument is a non-empty list of components to be sequentially composed.

The parametrization is as follows :

- `PipeSettings :: SomeOf<Overwrite>`

The behaviour is as follows :

- if the array of component is empty, an error is thrown
- the first component in the sequence is executed
- its sinks are merged with the sources :
  - if there is collision between sources and sinks, and `settings.overwrite` is false, throws an
   exception
  - otherwise, merge the sinks into the sources, with the sinks replacing the sources in case of 
  collision
- the process is iterated with the next component in sequence, with the merged object as its 
`sources` object.
- at the end of iteration, the sinks for the last component are returned as sinks of the 
`PipedComponent`

### Types
- `PipeSettings :: Record {`
- `  overwrite :: Boolean` **Optional - default : false**
- `}`
- `PipedComponent :: Component`

### Contracts
- if `settings.overwrite` is set to false, a component cannot return a sink whose sink name is 
equal to a source name - unless it is the final component in the component sequence.

# Example
cf. tests

# Tips
All components have the ability to include contracts in their definition. It is recommended to 
use those for some basic error management. A common risk in the sequential composition 
formulation is that the interface between components do not match, or match erronously. The 
appropriate contracts can check the relevant conditions prior to executing the component (<em>fail 
fast</em>). For instance, one can :

- check that the expected sources are present
- if necessary, also check that there are no extra sources (to use carefully, as it might be 
normal to have extra sources...) 

