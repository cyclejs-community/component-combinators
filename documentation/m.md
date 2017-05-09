# The case for `m`, the component factory
TODO : give some contextual understanding of the situation before in the GUI : jquery mixed ...,
then MVC - fat controller, then UI components, explained the benefits of componentization.

Componentization pursues two goals :

- reuse
- bottom-up construction of components/visual artifacts from lower level components

 There hence has to be a combining function which takes a number of components and derives
 from such a new component. Hence `combine :: Array<Component> -> Component`. That
 function can take any extra arguments, in which case by uncurrying it is always possible to come
  back the canonical `combine` form.
  As any component used to derive another component can itself have been derived, it is possible
  to represent a user interface by a component tree.

  The function `m` is a component factory which surfaces the tree, linking a bottom-up design
  process to a top-down processing of the component hierarchy.

Components here will be understood as ``:: Sources -> Settings -> Actions`, i.e. functions which
take :

- a `Sources` data structure which contains a way to receive event from event sources
- a `Settings` data structure which allows to parameterize the behaviour of the component

and return an `Actions` data structure which encodes the actions to be performed by the reactive
system under study.

So we have `parentComponent = combine (childrenComponents)``. From the signature of the `combine` we
 can deduce that the computation of the actions for the parent component can only involve :

- computations independent from the children `makeOwnSinks:: Sources -> Settings -> Actions` (cf.
 ![makeOwnSinks][makeOwnSinks])
- computations dependent from some or all children :
  - the most general form is `:: makeOwnSinks -> Array<Component> -> Sources -> Settings -> Actions`
  - as `Actions` combine well together (monoidal type), a common strategy is to build the
  parent actions from the list of both children actions and parent actions through merge. The
  corresponding form is :
  `mergeSinks :: Actions -> Array<Actions> -> Sources -> Settings -> Actions`
  - going further in the specialization, under the common hypothesis that `Actions` can be
  broken down into a product type, i.e. for isntance, `Actions :: HashMap<ActionName,
  ActionStream>`, where a given `ActionStream` can only be merged with another `ActionStream` of
  the same action name, we derive the most specialized form :
   `mergeSinks :: MergeActionsSpecs -> Actions -> Array<Actions> -> Sources -> Settings ->
   Actions`, where
   `MergeActionsSpecs :: HashMap<actionName, MergeActionStreamsFn>`, where
   `MergeActionStreamsFn :: ActionStream -> Array<ActionStream> -> Settings -> ActionStream`

[makeOwnSinks] : http://i.imgur.com/krnsBU0.png

`m` is such a combine function, which allows to write the parent component specified in the
formerly introduced general form or detailed form :

- general form
  - TODO : write some bla bla, no types or technical stuff though m({something}, settings,
  childrenComponents)
- detailed form
  - TODO : link that with the previous paragraph
- some drawing
