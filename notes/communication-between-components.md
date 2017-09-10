# Communication between components
This falls into the following categories : 

- commnication parent - child
- communication child - parent
- communication any - any

NOTE : child means direct child, i.e. does not include any great-children. Parent means also direct parent, i.e. does not include any great-parents or ancestors.

In the following, we present the main methods used to achieve those communication needs.

## Parent - child
Parent can pass parameters to its children components, allowing to parameterize their behaviour.

## Child - parent
A child component can return a sink which can be processed by a relevant component combinator to produce actions : the child component basically serves to compute an input to an action factory function operated by the component combinator. 

For instance :
- `child(sources, settings) returns {sinkA}`
- `m({makeActions}, {}, [parent, [child]])`
- `makeActions(parentSinkA, [childSinkA], settings)` returns actions computed from child's `sinkA`

Hence this is not a direct communication child parent, as we have an intermediary above both parent and children. However this allows for direct linking between the parent's output and the children outputs.

## any - any
1. pub/sub mechanism

    This is the common recommended way to achieve component to component communication when those communication do not share any direct parenting relationship. Both components subscribe to channels of interest and emit/receive relevant messages through those channels. 

2. communication through a common data structure

    Typically, one child updates a data set, while the other child is listening for updates on that data set. The nature of the update, the data set itself, and the data set content are the information used by the other child to make up the semantics of a message. This is very similar to redux with its action, store, dispatcher, controller architecture. The data set being updated serves as store. The child component performing the update can be viewed as sending an update action to that store. Any children listening on updates of that data set can be seen as subscribers to the dispatcher, etc. That shared mutable state can serve as a communication/synchronization device is well known (think about semaphore) and commonly used.

Both mechanism are essentially equivalent. A pub/sub can be view as a data structure which is updated with each incoming event and subscription event, and a data structure can associate its CRUD operations to a pub/sub mechanism.
