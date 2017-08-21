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

TODO : examples to give. `m([m([a]), m([b])])` etc is equivalent to m-fold ([[a,b]]). This means that [[a,b]] is the structure, and `m` is a folding function. There
could be other interesting folding functions.
TODO : talk about webcomponents, how this only touches the view part. `m` touches all actions

In what follows :

- `m` will be interchangeably termed as combinator, component factory, utility function, or helper function.
- In the specified domain, components will be understood as `:: Sources -> Settings ->
Actions`, i.e. functions which :
  - take a `Sources` data structure which contains a way to receive event from event sources
  - take a `Settings` data structure which allows to parameterize the behaviour of the component
  - return an `Actions` data structure which encodes the actions to be performed by the reactive system under study.

**NOTE** : The type definition for components is adapted from the one used in the reactive framework `cyclejs`. We added the `Settings` parameter to cleanly separate the parameterization/configuration concern from the reactive input processing concern. We believe this is an important, though trivial, design change, which allows for better readability. This is as a matter of fact in line with other major componentization efforts such as `React` which uses `props`  to that same parameterization effect.

# API

As explained before, we have `parentComponent = combine (childrenComponents)` - (cf. Fig `combine`).

![combine](http://i.imgur.com/C7y9x2A.png).

From the signature of the `combine`, we can deduce that the computation of the actions for the parent component can only involve :

- computations independent from the children `makeOwnSinks:: Sources -> Settings -> Actions`

![makeOwnSinks](http://i.imgur.com/zKruDeA.png)

- computations dependent from some or all children :
  - the most general form is `computeSinks :: makeOwnSinks -> Array<Component> -> Sources ->  Settings -> Actions`

  ![computeSinks](http://i.imgur.com/huxKPTJ.png)

  - when `Actions` combine well together (monoidal type), a common pattern is to build the parent actions from the list of both children actions and parent actions through merge. When  the `Sources` data structure only serves to generate children component actions, the general form can be specialized to :
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
 - children-independent sinks generation

In addition to the combining function specification, the `m` factory also receives settings which parameterize its behavior, and naturally the array of components from which it computes its resulting component.

 In what follows, the array of components will be termed as children component, while the component returned by the `m` factory will be called parent component. We will use `Sinks` as a type synonym for `Actions`, and `Sink` as a type synonym for `ActionStream`. This is to reuse the terminology put in vogue by `cyclejs`.

## `m :: CombineGenericSpecs -> Settings -> Array<Component>`
### Types
- `Component :: Sources -> Settings -> Sinks`
- `CombineGenericSpecs :: Record {`
  - `makeOwnSinks :: Sources -> Settings -> Sinks`
  - `computeSinks :: makeOwnSinks -> Array<Component> -> Sources -> Settings -> Sinks`
  - `makeLocalSources :: Optional < Sources -> Settings -> Sources >`
  - `makeLocalSettings :: Optional < Settings -> Settings >`
  - `checkPreConditions :: Optional < Sources -> Settings -> Boolean >`
  - `checkPostConditions :: Optional < Sinks -> Boolean >`
  - `}`

### Contracts
Aside from the type contracts, there is the possibility to configure user-defined contracts (pre- and post-conditions), which are predicates who return true if the contract is fulfilled. There is no further contracts.

### Description
The `m`  factory returns a component computed as follows :

1. contracts are checked
  - if one contract fails, an exception is raised
2. children-independent sinks are generated by calling `makeOwnSinks` (default value is null)
3. additional sources and settings are generated via `makeLocalSources`, and `makeLocalSettings`
  - `makeLocalSources` returns the extra sources to **INJECT** sources to the `children components`, which will be added to the sources passed in parameter by the parent component. If not present, no extra sources are added. `makeLocalSources` is called with the sources passed to the parent component and the merged settings
  - `makeLocalSettings` returns the extra settings to **INJECT** to the settings passed in parameter to the computed parent component.
    - If not present, no extra settings is added.
    - The local settings are computed from the merge of the computed parent component settings and  the `m` factory settings.
    - The local settings added have the lowest priority in case of conflict (cf. section on
    settings prioritization).
    - The settings passed in parameter to the computed parent component have the maximum priority.
    - the computed parent component settings have a priority between the two.
4. the `computeSinks` reducing function computes the parent sinks from the children-independent sinks, merged sources, merged settings, and array of children.

## `m :: CombineAllSinksSpecs -> Settings -> Array<Component> -> Component`
### Types
- `CombineAllSinksSpecs :: Record {`
  - `makeOwnSinks :: Sources -> Settings -> Sinks`
  - `mergeSinks :: makeOwnSinks -> Array<Sinks> -> Settings -> Sinks`
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

## `m :: CombinePerSinkSpecs -> Settings -> Array<Component> -> Component`
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
  - if there is a merge function defined in `mergeSinks` for that `sinkName`, that function is used to compute the resulting parent component sink from the children-independent sink, the children components' sinks, and the merged settings.
  - If not, a default merge function is used :
    - Default DOM merge function will merge the `VTree` from the children components INSIDE the `Vtree`
    from the children-independent DOM sink
      - if there is DOM sink, it return `null`
      - if there is no children-independent DOM sink, then it returns the children VTrees wrapped in a `div` VNode
      - if there is a children-independent DOM sink, and there is no children DOM sinks, then it
      returns the children-independent DOM sink
      - if there is a children-independent DOM sink, and there are children DOM sinks, then it returns a VTree in which the children DOM sinks are children of the children-independent
      DOM VNode and appended to any existing children
    - Default non-DOM merge function will merge the children-independent sink together with the children sinks via simple stream merge (i.e. `Rx.Observable.merge`)

# Examples
In this section, we are going to show miscellaneous examples of use of componentization with the`m` factory.
Most of those examples will be inspired from already-existent UI component library, such as`Semantic UI`.

## Event factory component
`Events = m(EventFactorySpec, EventFactorySettings, childrenComponents)`
`Events = mEventFactory(EventFactorySettings, childrenComponents)`

This example makes use of :
- `checkPreConditions`
- `makeOwnSinks`
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

Note that all events generated from the DOM remove the default DOM side effect with
`preventDefault`.

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
TODO : implement, include a link to the code on github, and excerpts from it with `...` for low relevant part of the code, maybe explain a bit or better do that in the source code in fact.
Include a link to the tests

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
TODO : implement, include a link to the code on github, and excerpts from it with `...` for low relevant part of the code. That means include ButtonComponentSpec as comments in the source code

We hence have :
  - `makeOwnSinks` which generates `<div class = 'ui button ...'> </div>`
    - class list will depend on settings
  - `childrenSinks` merged DOM which correspond to `Content` in
  `<div class = 'ui button ...'> Content </div>`
    - that is the default DOM merge
    - we keep also the non-DOM sinks returned by the children
    - content MAY be empty

#### demo
**TODO : MDIV OR LIFT**

Button = curry(m)(ButtonSpecs)
Show = curry(m)({}) // simplest component to apply default sink merges
ShowContent = curry(mDiv)({class : 'visible content'}) // mdiv = lifting div(...) into a `m` component, OR
ShowContent = lift(div({class : 'visible content'}) // CURRIED, FIND A WAY TO WRITE IT
ShowContent = curry(div)({class : 'visible content'})
component, OR
HideContent = curry(mDiv)({class : 'hidden content'}) // polymorphic, last arg can be text or [Comp]

UI = [
  mButton({animated:true}, [
    mLift(ShowContent('Next')),
    mLift(HideContent([
      icon({class : 'right arrow icon'})
    ]))
  ]),
  mButton({animated: 'vertical'}, [
    HideContent('Shop'),
    ShowContent ([
      icon({class : 'shop icon'})
    ])
  ]),
  mButton({animated: 'fade'}, [
    ShowContent ('Sign-up for a Pro account'),
    HideContent ([
      mText('$12.99 a month') // TODO : how to indicate text??
    ])
  ]),
]

demo - Show({}, UI)

This should produce the following HTML code :

```html
<div class="ui animated button" tabindex="0">
  <div class="visible content">Next</div>
  <div class="hidden content">
    <i class="right arrow icon"></i>
  </div>
</div>
<div class="ui vertical animated button" tabindex="0">
  <div class="hidden content">Shop</div>
  <div class="visible content">
    <i class="shop icon"></i>
  </div>
</div>
<div class="ui animated fade button" tabindex="0">
  <div class="visible content">Sign-up for a Pro account</div>
  <div class="hidden content">
    $12.99 a month
  </div>
</div>
```

## Button group component
  - or : 'true, false'
  - layout : 'attached, top attached, bottom attached, left attached, right attached, vertical. '
  - icon : 'true, false'
  - equalWidth : 'three, five'
  - labeled : 'true, false' - only in conjunction with icon? i.e. labeled icon
  - size : cf. property for button component, here applies to the whole group
  - emphasis : cf. property for button component, here applies to the whole group
  - listenTo : event list such as click, hover, etc.


# Possible improvements
- should make `localSettings`, settings which are only applied locally, i.e. for `makeOwnSinks`, and not passed down to the children. That would allow to customize those own sinks as a function of the settings from construction time (inherited from parent and ancestors) at runtime. Settings  for now are inherited as `parent <- grand parent <- ... patriarch`.

Bibliography
Brooks, Fred P. (1986). "No Silver Bullet — Essence and Accident in Software Engineering". Proceedings of the IFIP Tenth World Computing Conference: 1069–1076

Ernst, Erik. "Separation of concerns." Proceedings of the AOSD 2003 Workshop on Software-Engineering Properties of Languages for Aspect Technologies (SPLAT), Boston, MA, USA. 2003.
https://pdfs.semanticscholar.org/c052/f9d0e7e4c89a9d7abd36ffed4051ec59bb64.pdf
