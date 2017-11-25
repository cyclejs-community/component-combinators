# The case for `m`, the component factory

Componentization pursues three goals :

- reuse - the most important factor of productivity gain
- separation of concerns - which fosters quality and maintainability
- using a limited number of operations and atomic components to build a large
   set of components - reducing complexity and increasing readability

At the core of this approach there is a combining function which takes a number of
components and derives a new component, i.e `combine :: Array<Component> -> Component`. That  function can take any extra arguments, in which case, by uncurrying, it is always possible to come back the canonical `combine` form shown previously.   As any component used to derive another component can itself have been derived,   componentization naturally leads to the manipulation of component trees.

  The function `m` is a such a combinator, specialized to the domain of reactive systems's user   interface, which abstracts out a limited set of operations/patterns by which a component tree can be composed.

The speculated benefits are :

   - linking a bottom-up user interface design with a bottom-up user-interface implementation
   - making the component tree explicit which allows for top-down processing (more on that elsewhere)

**TODO** : having the component tree explicit allows to post-process it or pre-process it as needed. For instance, running the app is akin to performing a monadic tree traversal of the component tree, where action sinks are reduced during traversal, and the DOM tree is monoidally assembled. Other traversal could check syntactic contracts prior to running the app. A pre-processing stage could add aspects (logging, tracing, etc.)
**TODO** : make the link with webcomponents, which only gives the view and event part. This can be construed as a generalization of webcomponents in so far as it allows to also express the computation of the actions.

In what follows :

- `m` will be interchangeably termed as component combinator, component factory, utility function, or helper function.
- In the specified domain, components will be understood as `:: Sources -> Settings ->
Actions`, i.e. functions which :
  - take a `Sources` data structure which contains a way to receive event from event sources
  - take a `Settings` data structure which allows to parameterize the behaviour of the component
  - return an `Actions` data structure which encodes the actions to be performed by the reactive system under study.

**NOTE** : The type definition for components is adapted from the one used in the reactive framework `cyclejs`. We added the `Settings` parameter to cleanly separate the parameterization/configuration concern from the reactive input processing concern. We believe this is an important, though trivial, design change, which allows for better readability. This is as a matter of fact in line with other major componentization efforts such as `React` which uses `props`  to that same parameterization effect.

# API

As explained before, we have `combinedComponent = combine (childrenComponents)` - (cf. Fig `combine`).

![combine](http://i.imgur.com/C7y9x2A.png).

From the signature of the `combine`, we can deduce that the computation of the actions for the combined component can only involve :

- computations independent from the children `makeOwnSinks:: Sources -> Settings -> Actions`
	- the signature is naturally that of a component, we will call it in what follows the parent component (`parentComponent`). It is what the `combinedComponent` is in absence of any children.

![makeOwnSinks](http://i.imgur.com/zKruDeA.png)

- computations dependent on some or all children :
  - the most general form is `computeSinks :: parentComponent -> Array<Component> -> Sources ->  Settings -> Actions`

  ![computeSinks](http://i.imgur.com/huxKPTJ.png)

  - when `Actions` combine well together (monoidal type), a common pattern is to build the combined actions from the list of both children actions and parent actions through merge. When  the `Sources` data structure only serves to generate children component actions, the general form can be specialized to :
  `mergeSinks :: Actions -> Array<Actions> -> Settings -> Actions`

  ![mergeSinks - function](http://i.imgur.com/hW97jzn.png)

  - going further in the specialization, under the additional hypothesis that `Actions` can be  broken down into a product type, i.e. for instance, `Actions :: HashMap<ActionName,  ActionStream>`, where a given `ActionStream` can only be merged with another `ActionStream` of  the same action name, we derive the most specialized form :
    - `mergeSinks :: MergeActionsSpecs -> Actions -> Array<Actions> -> Settings -> Actions`, where
      - `MergeActionsSpecs :: HashMap<ActionName, MergeActionStreamsFn>`, where
        - `MergeActionStreamsFn :: ActionStream -> Array<ActionStream> -> Settings -> ActionStream`

   ![mergeSinks - specs](http://i.imgur.com/kv87fhl.png)

The API of `m` derives directly from these considerations.

The `m` factory function have several signatures according to the form chosen to specify the combining function :

 - generic form
 - specialized form
 - most-specialized form

Other specification parameters for the combining function are the same for all forms :

 - contract checking
 - sources and settings adjustment

In addition to the combining function specification, the `m` factory also receives settings which parameterize its behavior, and naturally the array of components from which it computes its combined component.

 In what follows :

- the array of components will be termed as component tree,
- the component tree will enclose a parent component (root), and children components (leaves)
- the component returned by the `m` factory will be called combined component.
- We will use `Sinks` as a type synonym for `Actions`, and `Sink` as a type synonym for `ActionStream`. This is to reuse the terminology put in vogue by `cyclejs`.

## `m :: CombineGenericSpecs -> Settings -> ComponentTree -> Component`
### Types
- `Component :: Sources -> Settings -> Sinks`
- `ComponentTree :: ChildrenComponents | [ParentComponent, ChildrenComponents]`
- `ParentComponent:: Component`
- `ChildrenComponents :: Array<Component>`
- `CombineGenericSpecs :: Record {`
  - `  computeSinks :: ParentComponent -> Array<Component> -> Sources -> Settings -> Sinks`
  - `  makeLocalSources :: Optional < Sources -> Settings -> Sources >`
  - `  makeLocalSettings :: Optional < Settings -> Settings >`
  - `  checkPreConditions :: Optional < Sources -> Settings -> Boolean >`
  - `  checkPostConditions :: Optional < Sinks -> Boolean >`
  - `}`

### Contracts
Aside from the type contracts, there is the possibility to configure user-defined contracts (pre- and post-conditions), which are predicates who return true if the contract is fulfilled. There is no further contracts.

### Description
The `m`  factory returns a component computed as follows :

1. contracts are checked
  - if one contract fails, an exception is raised
2. additional sources and settings are generated via `makeLocalSources`, and `makeLocalSettings`
  - `makeLocalSources` returns the extra sources to **INJECT** sources to the children and parent components.
	  - If not present, no extra sources are added.
	  - `makeLocalSources` is called with the sources passed to the combined component and the fully merged settings (i.e. include also settings from `makeLocalSettings`)
		  -  Note that so far there has been no cases where an extra source might depend on settings. We expect the local sources factory to be independent of any settings but keep the door open, should that case occur.
	  -  In case of conflict, the local sources factory has the lowest precedence vs. the factory sources
  - `makeLocalSettings` returns the extra settings to **INJECT** to the settings passed in parameter to the computed combined component.
    - If not present, no extra settings is added.
    - The local settings are computed from the merge of the computed combined component settings and  the `m` factory settings.
    - The local settings added have the lowest priority in case of conflict (cf. section on
    settings prioritization).
    - The settings passed in parameter to the combined component have the maximum priority.
    - the computed combined component settings have a priority between the two.
3. the `computeSinks` reducing function computes the combined component's sinks from the parent component, children component, merged sources, and merged settings.

## `m :: CombineAllSinksSpecs -> Settings -> ComponentTree -> Component`
### Types
- `CombineAllSinksSpecs :: Record {`
  - `makeOwnSinks :: Sources -> Settings -> Sinks`
  - `mergeSinks :: parentComponent -> Array<Sinks> -> Settings -> Sinks`
  - `makeLocalSources :: Optional < Sources -> Settings -> Sources >`
  - `makeLocalSettings :: Optional < Settings -> Settings >`
  - `checkPreConditions :: Optional < Sources -> Settings -> Boolean >`
  - `checkPostConditions :: Optional < Sinks -> Boolean >`
  - `}`

### Contracts
This signature fulfills the same contract as the general signature.

### Description
The `m`  factory returns a component computed as follows :

1-3. same as in the general signature
4. Sinks are computed for each child component from the merged sources and merged settings.
5. Those sinks are later reduced by `mergeSinks` into the parent component sinks.

## `m :: CombinePerSinkSpecs -> Settings -> ComponentTree -> Component`
### Types
- `Sinks :: HashMap<SinkName, Sink>`
- `Sink :: Stream <*>`
- `CombinePerSinkSpecs :: Record {`
  - `makeOwnSinks :: Sources -> Settings -> Sinks`
  - `SinkMergeFn :: Sink -> Array<Sink> -> Settings -> Sinks`
  - `mergeSinks :: HashMap<SinkName, SinkMergeFn>`
  - `makeLocalSources :: Optional < Sources -> Settings -> Sources >`
  - `makeLocalSettings :: Optional < Settings -> Settings >`
  - `checkPreConditions :: Optional < Sources -> Settings -> Boolean >`
  - `checkPostConditions :: Optional < Sinks -> Boolean >`
  - `}`

### Contracts
This signature fulfills the same contract as the general signature.

### Description
The `m`  factory returns a component computed as follows :

1-3. same as in the general signature
4. Sinks are computed for each child component from the merged sources, and merged settings.
5. For each sink (uniquely identified by `sinkName::SinkName`) :
  - if there is a merge function defined in `mergeSinks` for that `sinkName`, that function is used to compute the resulting combined component sink from the parent's sink, the children components' sinks, and the merged settings.
  - If not, a default merge function is used :
    - Default DOM merge function will merge the `VTree` from the children components **INSIDE** the `Vtree` from the parent DOM sink[^2]
      - if there is no DOM sink at all, it returns `null`
      - if there is no parent DOM sink, then it returns the children VTrees wrapped in a `div` VNode
      - if there is a parent DOM sink, and there is no children DOM sinks, then it       returns the parent DOM sink
      - if there is a parent DOM sink, and there are children DOM sinks, then it returns a VTree in which the children DOM vNodes are children of the parent's vNode
      children vNodes are **appended** to any already existing children of the parent vNode
    - Default non-DOM merge function will merge the parent's sink together with the children sinks via simple stream merge (i.e. `Rx.Observable.merge`)

[^2]: that is about the main justification of while it is termed parent component : independent of the children and children go inside of it

# Examples
In this section, we are going to show miscellaneous examples of use of componentization with the`m` factory.
Most of those examples will be inspired from already-existent UI component library, such as`Semantic UI`.

## Event factory component
- `Events = m(EventFactorySpec, EventFactorySettings, componentTree)`, or by currying `m` into `mEventFactory`
- `Events = mEventFactory(EventFactorySettings, componentTree)`

This example makes use of :
- `checkPreConditions`
- a component tree with parent and children
- `mergeSinks`
- utility function `defaultMergeSinkFn`

### Description
This component allows to create events from event sources. For ease of reasoning and
maintainability, the created events should be coupled to the DOM representation generated by the children component. There is however no enforcement of such property. The created events will be mixed with the sinks returned from the children components.

Contracts:

- an event sink generated from event sources MUST NOT conflict with a sink with the same key from the children component
- there MUST be an `events` property in the settings object. The corresponding object MAY be empty (event factory created no events).

###  EventFactorySettings
- `{`
  - `events : {`
    - `custom : {eventName : (sources, settings) =>  event$},`
    - `DOM : { DomEventName : {selectorDesc : 'selector'}}`
  - `}`
- `}`

Note that all events generated from the DOM remove the default DOM side effect with `preventDefault`.

#### `events.DOM` property
`events.DOM` is a list of selectors that MAY be later used in the children components, for instance to uniquely identify the target of an event. This allow to parameterize the coupling between the parent and the children components, i.e. between the events and the event targets.

`events.DOM` is also used to set an event listener on the matching DOM element (as specified by `selector`). Corresponding listened-to events will be streamed through a sink with identifier `[selectorDesc]_[DomEventName]`.

For instance :
```
{
  events : {
    DOM : {
      click : {
        PriceSelector : '.block--modifier-value'
      }
    }
  }
}
```

will lead to registering a listener on the DOM element(s) identified by the selector `
.block--modifier-value`. As the events factory parameterization is inherited by
children (through settings), children components can reference within their DOM tree the passed on selector (`settings.events.DOM.click.PriceSelector`). Repetition is avoided and the coupling of behaviour and visual representation is made explicit.

#### `events.custom` property
This allows for generating a custom stream of events from the event source and settings.

For instance :
```
{
  events : {
    custom : {
      [eventName] : (sources, settings) => sources.motionSensor.zipWith(sources.locationSensor)
    }
  }
}
```

The resulting stream of events is passed through the sink `eventName`.

### Source code
cf. repo

## Button component
`Button = m(ButtonComponentSpec, ButtonComponentSettings, childrenComponents)`
`Button = mButton(ButtonComponentSettings, childrenComponents)`

This example makes use of :
- `checkPreConditions`
- `makeOwnSinks`
- default merge of sinks (DOM and non-DOM sinks)

### Description
The button component is a `<div>` that will behave like a button, according to the parameters specified in settings. Cf. `semanticUI` documentation for a description of the settings properties.

- The component MAY listen to any of the regular DOM event associated to a button:
  - click, hover, etc.
- A button MAY have content inside, which is any valid HTML representation
- A button component inserts inside its tag the DOM content from its children components.
- Any non-DOM children sink is default-merged with the button sink with the same sink name.

###  ButtonComponentSettings
**TODO : UPDATE** with latest from code

  - classes
  - emphasis : 'primary, secondary, positive, negative, basic'
  - tabIndex
  - animated : {'', fade, vertical}
  - label : {text, position : 'left, right'}
  - icon : for instance 'cloud' - must be mapped to an actual icon previously
  - visualState : 'active, disabled, loading'
  - social : 'facebook, twitter, google, vk, linkedin, instagram, youtube'
  - size 'mini tiny small medium large big huge massive'
  - layout : 'compact, fluid, attached, top attached, bottom attached, left attached, right attached'
  - listenTo : event list such as click, hover, etc.

### Source code
Cf. repo

```javascript
export function mButton(mButtonSettings, childrenComponents) {
  // returns a DOM tree representation with the specifications passed through settings
  // and enclosing the DOM trees returned by the children components
  // Other children sinks are default-merged

  return m(mButtonSpec, mButtonSettings, [makeButtonSinks, childrenComponents])
}

function makeButtonSinks(sources, settings) {
  let attrs = {};
  const buttonClasses = ['ui', 'button'];
  const focusable = true;
  const {
    classes, listenOn, emphasis, basic, animated, label, icon, visualState, social, size, shape, layout, listenTo
  } = settings;

  if (classes) {
    Array.prototype.push.apply(buttonClasses, classes);
  }

  if (focusable) {
    attrs.tabindex = '0';
  }

  if (emphasis) {
    buttonClasses.push(emphasis);
  }

[...]

  const classObject = buttonClasses
    ? reduce((acc, className) => {
      acc[className] = true
      return acc
    }, {}, buttonClasses)
    : null;

  let sinks = {};
  if (listenTo && listenOn) {
    sinks = reduce((acc, eventName) => {
      acc[eventName] = sources.DOM.select(listenOn).events(eventName);

      return acc
    }, {}, listenTo)
  }
  sinks.DOM = $.of(
    div({
      class: classObject,
      attrs: attrs
    })
  )

  return sinks
}

```

We hence have :
  - `makeButtonSinks` which generates `<div class = 'ui button ...'> </div>`
    - class list will depend on settings
  - children component's DOM sinks will correspond to `Content` in
  `<div class = 'ui button ...'> Content </div>`
    - that is the default DOM merge
    - we keep also the non-DOM sinks returned by the children (default non-DOM sink merge)
    - content MAY be empty

#Tips
- when writing the component tree, a common error is to use `[parentComponent]` to signify a parent component without children. This will actually be parsed as one unique child component (i.e. as `[uniqueChild]`). The correct syntax would be `[parentComponent, []]`.

# Roadmap
- review settings inheritance
	- ? should make `localSettings`, settings which are only applied locally, i.e. for `parentComponent`, and not passed down to the children. That would allow to customize those parent sinks as a function of the settings from construction time (inherited from parent and ancestors) at runtime. Settings  for now are inherited as `parent <- grand parent <- ... patriarch`.
- TODO : design better trace information
    // for instance outer trace could be concatenated to inner trace to trace also the
    // component hierarchy
- TODO : also add slot mechanism to default DOM merge to include child component at given
    // position of parent
    //       necessary to add a `currentPath` parameter somewhere which
    //       carries the current path down the tree

Bibliography
Brooks, Fred P. (1986). "No Silver Bullet — Essence and Accident in Software Engineering". Proceedings of the IFIP Tenth World Computing Conference: 1069–1076

Ernst, Erik. "Separation of concerns." Proceedings of the AOSD 2003 Workshop on Software-Engineering Properties of Languages for Aspect Technologies (SPLAT), Boston, MA, USA. 2003.
https://pdfs.semanticscholar.org/c052/f9d0e7e4c89a9d7abd36ffed4051ec59bb64.pdf
