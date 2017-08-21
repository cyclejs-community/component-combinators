[TOC]

# Rationale
Among issues which are a constant source of bugs in the development of interactive webapps, four stand out :

- data synchronization
	- online vs. offline
	- distributed applications
	- client/server applications
- state management
- effect management
	- actually could be considered as generalizing issues from state management
	- current effect type systems expose effect as a tuple (type, region, operations, handler)
- asynchrony

Cycle applications tackle particularly the last two issues, by proposing an architecture in which :

- effect types are discriminated
	- read-effects (side-causes) are at the top
	- write-effects (side-effects) are at bottom
- effect handlers (termed as **drivers**) can connect their read and write operations through a **cycle**
- asynchronous data flows are handled by using a push (reactive) stream-based system based on producers, listeners, schedulers, and combining operators.
- time-independent relationships between entities are expressed through pure functions between streams

While this architecture helps alleviate a part of the targeted issues,  common pain points encountered at scale are :

- modelizing time-dependent relationships between entities
	- time-dependent control flow
	- dynamic graph
		- streams' join and switch
		- creation and deletion of portion of a stream graph
	- subscription/unsubscription/error side-effects
- reasoning about complex data flows
	- complex static graph 
		- resulting in a hard-to-comprehend call tree with large depth
	- dynamic graph
	- what happens in case of errors? How to switch back to a known state ?
- tracing and visualizing data flows
	- debugging, particularly in the face of higher-order streams, is often an arduous and time-consuming task due to the lack of visibility on the inner state of streams

The present effort aims at tackling the last two points, in a way that would be effective, efficient and friendly enough, by surfacing the component call tree in a friendly format.

For example, here is the state of a dynamic data flow graph (taken from `cycle` documentation - BMI slider application), after a second component has been added :

![cycle BMI component](http://i.imgur.com/9dxHkIO.png)

The present effort is but a modest intermediary step towards obtaining a live stream of such flow graphs. 

# Methodology and objectives 

Following the fact that component in `Cycle` are functions, generating the data flow graph turns into the subsidiary issue of generating a call graph. We facilitate this endeavor by directly exposing the component tree through a set of helpers, *à la `snabbdom`*.

## Recursive component building {#mExample}
For instance, the following cycle component definitions :

```javascript
function TabbedComponent(sources) {
  // Fetch data to feed the tabs with
  sources.salesEMEA$ = sources.database('EMEA');
  sources.salesAmerica$ = sources.database('America');

  // Build children tabs by using the Tab component
  var leftTabSinks = Tab(sources, 'salesEMEA');
  var rightTabSinks = Tab(sources, 'salesAmerica');

  // Build output
  var combineSinksFn = function (x, y) {return div('.tabbed', [x, y]);};

  return {
    DOM: combine(
      leftTabSinks.DOM,
      rightTabSinks.DOM,
      combineSinksFn
    ),
    actions$: merge(leftTabSinks.action$, rightTabSinks.action$)
  }
}


function Tab (sources, options) {
  var source$ = sources[options];
    
  return {
    DOM : source$.map(source =>  div ('.tab', source))
  }
}
```

would be expressed as (some implementation details left aside) :

```javascript
const TabbedComponent = m(null,
  {classes: '.tabbed'},
  {makeLocalSources : makeTabSources, mergeSinks: mergeTabSinks}, [
    m(Tab, {source: 'salesEMEA'}, null, []),
    m(Tab, {source: 'salesAmerica'}, null, [])
  ])

function mergeTabSinks(ownSinks, childrenSinks, options) {
  var combineSinksFn = function (x, y) {return div('.tabbed', [x, y]);};

  return combine(
      $.just(combineSinksFn),
      childrenSinks,
      function (f, x, y) {return f(x, y);}
    )
}

function makeTabSources (sources) {
  sources.salesEMEA$ = sources.database('EMEA');
  sources.salesAmerica$ = sources.database('America');

  return sources;
}
```

resulting in, for example, the following data flow graph : 

![mermaid representation](http://i.imgur.com/VNPEnVX.png)

on which the flowing data could be represented as an edge label in differed time.

## Objectives

The adopted recursive call structure based on the `m` helper, similar to the `h` snabdom's helper, makes the component tree explicit and allows to :

- add debugging/tracing information at entry/exit step in the data flow graph
	- any piece of data incoming/outcoming on any source/sinks can be accurately related to its graph location (path in the component tree)
	- useful for simple text logging, but also for visual debugging


# Type definitions and key constructs

## Key types

| Type              | Type definition           |
| -------------     |:-------------|
| T                 | `*` |
| Opt T             | `Maybe T` |
| Settings          | `Opt Hash *` |
| Hash *            | Represent an object made of properties of any type |
| Settings$Fn       | `Sources -> Settings -> Observable Settings`|
| Record *          | Represent an object made of properties of specific type |
| Selector          | a css selector|
| Text$Fn           | `Sources -> Settings -> Observable String`|
| Source            | `Observable T` |
| Sink              | `Observable T` |
| Sources           | `Hash Source` |
| Sinks             | `Hash Sink` |
| Component         | `Sources -> Settings -> Sinks` |
| Component\_Def    | `Record (mergeSinks \| makeLocalSources \| makeLocalOptions \| sourcesContract \| sinksContract)` |
| Component_Options | `Hash *` |
| Contracts         | `[Contract]`|
| Contract          | `TBD` basically ensure sources contains some specific properties, and throw an exception with an error message if not|
| sourcesContract   | `Contract` |
| sinksContract     | `Contract` |
| VNode             | `Record (Selector \| Data \| Children \| String \| Element \| Key)` |
|---

## Key function signatures

| Function | Type definition           |
| -------------  |:-------------|
| combineLatest  | `[Observable T] -> Observable [T]` |
| merge          | `[Observable T] -> Observable T` |
| makeLocalSources  | `Sources -> Settings -> Sources`|
| makeLocalOptions  | `Opt Component_Options -> Opt Component_Options`|
| mergeSinks       | `Opt Sinks -> [Sinks] -> Settings -> Sinks`|
| h                | `Opt Selector -> Settings -> (Children\|Opt String) -> VNode`  |
| m                | `Opt Component_Def -> Opt Component_Options ->  -> [Opt Component] -> Component`      |
| mdiv             | `Selector -> (Settings\|Settings$Fn) -> ([VNode\|Component] \| Text$Fn)-> Component` |
| ....overload     | `Selector -> ([VNode\|Component] \| Text$Fn)-> Component` |
| ....overload     | `[VNode\|Component]-> Component` |
|---

## Implementation
Implementation of a proof of concept is ongoing. Follows the shell for an implementation of the `m` helper. 

### `m` helper

Non-updated version reproduced here for reference.  Updated version in the repository.

#### Diagram
The innerworkings of the `m` helper can be summarized by the following diagram :

![m algorithm diagram](http://i.imgur.com/nZejFxz.png))


# Example of use

Supposing a designer came up with a sketch of Sparks landing page :

![Imgur](http://i.imgur.com/sl0e6eZ.png)

The landing page could be written as : 

```javascript
import {Route, Auth} from 'utils/components'
import {Button} from 'components'

const LoginPage = m(null, null, null, [
  m(Route, {route: '/'}, {}, [
    m(Auth, {case: true}, {}, [
      LoggedInView
    ]),
    m(Auth, {case: false}, {}, [
      LoggedOutView
    ]),
  ]),
  m(Route, {route: 'dash/being'}, {}, [
    m(Auth, {case: true}, {makeExtraSources: (sources, settings) => ({userProfile$: TODO, etc})}, [
      DashboardPage // TODO
    ]),
    m(Auth, {case: false}, {}, [
      LoggedOutView
    ]),
  ])
])

const LoggedInView = m(Redirect, {redirect: 'dash/being'}, null, [])

const LoggedOutView = m(null, null, null, [
  m(Container, {imageSrc: './...jpg', class: {'interstitial-login': true, 'sparks-dialog': true}}, [
    mdiv('.logo', []),
    mdiv('', 'We need to know who you are'),
    mdiv('.buttons', [
      m(SignInAction, null, {mergeSinks: (_, [{signInGoogle$}], settings) => ({queue$: TODO, auth$: TODO})}, [
        m(Button, {click: 'signInGoogle'}, [
          mdiv('', {class: {google: true, 'sign-in': true}}, [
            h('i', {class: {'icon-google': true}}, []),
            h('span', 'Sign in with Google')
          ])
        ])
      ]),
      m(SignInAction, null, {mergeSinks: (_, [{signInFacebook$}], settings) => ({queue$: TODO, auth$: TODO})}, [
        m(Button, {click: 'signInFacebook'}, [
          mdiv('', {class: {facebook: true, 'sign-in': true}}, [
            h('i', {class: {'icon-facebook-official': true}}, []),
            h('span', 'Sign in with Facebook')
          ])
        ])
      ])
    ])
  ])
])
```

which should produce a VDom tree which produces this DOM tree :

```html
// <div class="sparks-dialog interstitial-login" style="background">
//   <div class="logo"></div>
//   <div>We need to know who you are</div>
//   <div class="buttons">
//     <button class="google sign-in">
//       <i class="icon-google"></i>
//       Sign in with Google
//     </button>
//     <button class="facebook sign-in">
//       <i class="icon-facebook-official"></i>
//       Sign in with Facebook
//     </button>
//   </div>
// </div>
```

Other sinks are reduced by applying default reducers (as done currently by means of  `combineDOMtoDivs` and `mergeOrFlatMapLatest` :

- `LoginPage.queue$` will be built by reducing the 2 `queue` sinks from the 2 `SignInAction` components
- `LoginPage.auth$` will be built by reducing the 2 `auth` sinks from the 2 `SignInAction` components

If the event that the default reducer would be inappropriate, a custom reducer can be passed using the `mapReduce` parameter of the `m` helper.


# The case for `m`, the component factory

Componentization pursues three goals :

- reuse - the most important factor of productivity gain
- separation of concerns - which fosters quality and maintainability
- using a limited number of operations and atomic components to build a large
   set of components - reducing complexity and increasing readability

At the core of this approach there is a combining function which takes a number of
components and derives
 a new component, i.e `combine :: Array<Component> -> Component`. That
 function can take any extra arguments, in which case, by uncurrying, it is always possible to come
  back the canonical `combine` form shown previously.
  As any component used to derive another component can itself have been derived,
  componentization naturally leads to the manipulation of component trees.

  The function `m` is a such a combinator, specialized to the domain of reactive systems's user
  interface, which abstracts out a limited set of operations/patterns by which a component tree
  can be composed.

   The speculated benefits are :

   - linking a bottom-up user interface design with a bottom-up user-interface implementation
   - making the component tree explicit which allows for top-down processing (more on that
   elsewhere)

TODO : examples to give. `m([m([a]), m([b])])` etc is equivalent to m-fold ([[a,b]]). This
means that [[a,b]] is the structure, and `m` is a folding function. There
could be other interesting folding functions.
TODO : talk about webcomponents, how this only touches the view part. `m` touches all actions

In what follows :

- `m` will be interchangeably termed as combinator, component factory, utility function, or
helper function.
- In the specified domain, components will be understood as `:: Sources -> Settings ->
Actions`, i.e. functions which :
  - take a `Sources` data structure which contains a way to receive event from event sources
  - take a `Settings` data structure which allows to parameterize the behaviour of the component
  - return an `Actions` data structure which encodes the actions to be performed by the reactive
system under study.

**NOTE** : The type definition for components is adapted from the one used in the reactive
framework `cyclejs`. We added the `Settings` parameter to cleanly separate the
parameterization/configuration concern from the reactive input processing concern. We believe
this is an important, though trivial, design change, which allows for better readability. This is as a
matter of fact in line with other major componentization efforts such as `React` which uses `props`
 to that same parameterization effect.

# API

As explained before, we have `parentComponent = combine (childrenComponents)` - (cf. Fig `combine`).

![combine](http://i.imgur.com/C7y9x2A.png).

From the signature of the `combine`, we can deduce that the computation of the actions for the
parent component can only involve :

- computations independent from the children `makeOwnSinks:: Sources -> Settings -> Actions`

![makeOwnSinks](http://i.imgur.com/zKruDeA.png)

- computations dependent from some or all children :
  - the most general form is `computeSinks :: makeOwnSinks -> Array<Component> -> Sources ->
  Settings -> Actions`

  ![computeSinks](http://i.imgur.com/huxKPTJ.png)

  - when `Actions` combine well together (monoidal type), a common pattern is to build the
  parent actions from the list of both children actions and parent actions through merge. When
  the `Sources` data structure only serves to generate children component actions, the
  general form can be specialized to :
  `mergeSinks :: Actions -> Array<Actions> -> Settings -> Actions`

  ![mergeSinks - function](http://i.imgur.com/hW97jzn.png)

  - going further in the specialization, under the additional hypothesis that `Actions` can be
  broken down into a product type, i.e. for instance, `Actions :: HashMap<ActionName,
  ActionStream>`, where a given `ActionStream` can only be merged with another `ActionStream` of
  the same action name, we derive the most specialized form :
    - `mergeSinks :: MergeActionsSpecs -> Actions -> Array<Actions> -> Settings -> Actions`, where
      - `MergeActionsSpecs :: HashMap<ActionName, MergeActionStreamsFn>`, where
        - `MergeActionStreamsFn :: ActionStream -> Array<ActionStream> -> Settings -> ActionStream`

   ![mergeSinks - specs](http://i.imgur.com/kv87fhl.png)

The API of `m` derives directly from these considerations.

The `m` factory function have several signatures according to the form chosen to specify the
combining function :

 - generic form
 - specialized form
 - most-specialized form

Other specification parameters for the combining function are the same for all forms :

 - contract checking
 - sources and settings adjustment
 - children-independent sinks generation

In addition to the combining function specification, the `m` factory also receives settings which
 parameterize its behavior, and naturally the array of components from which it computes its
 resulting component.

 In what follows, the array of components will be termed as children
 component, while the component returned by the `m` factory will be called parent component. We
 will use `Sinks` as a type synonym for `Actions`, and `Sink` as a type synonym for
 `ActionStream`. This is to reuse the terminology put in vogue by `cyclejs`.

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
Aside from the type contracts, there is the possibility to configure user-defined contracts
(pre- and post-conditions), which are predicates who return true if the contract is fulfilled.
There is no further contracts.

### Description
The `m`  factory returns a component computed as follows :

1. contracts are checked
  - if one contract fails, an exception is raised
2. children-independent sinks are generated by calling `makeOwnSinks` (default value is null)
3. additional sources and settings are generated via `makeLocalSources`, and `makeLocalSettings`
  - `makeLocalSources` returns the extra sources to add to the `sources` passed in parameter to the
  computed parent component. If not present, no extra sources are added. `makeLocalSources` is
  called with the sources passed to the parent component and the merged settings
  - `makeLocalSettings` returns the extra settings to add to the settings passed in parameter to
  the computed parent component.
    - If not present, no extra settings is added.
    - The local settings are computed from the merge of the computed parent component settings and
  the `m` factory settings.
    - The local settings added have the lowest priority in case of conflict (cf. section on
    settings prioritization).
    - The settings passed in parameter to the computed parent component have the maximum priority.
    - the computed parent component settings have a priority between the two.
4. the `computeSinks` reducing function computes the parent sinks from the children-independent
sinks, merged sources, merged settings, and array of children.

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
  - if there is a merge function defined in `mergeSinks` for that `sinkName`, that function is used
   to compute the resulting parent component sink from the children-independent sink, the children
  components' sinks, and the merged settings.
  - If not, a default merge function is used :
    - Default DOM merge function will merge the `VTree` from the children components INSIDE the `Vtree`
    from the children-independent DOM sink
      - if there is DOM sink, it return `null`
      - if there is no children-independent DOM sink, then it returns the children VTrees wrapped
       in a `div` VNode
      - if there is a children-independent DOM sink, and there is no children DOM sinks, then it
      returns the children-independent DOM sink
      - if there is a children-independent DOM sink, and there are children DOM sinks, then it
      returns a VTree in which the children DOM sinks are children of the children-independent
      DOM VNode and appended to any existing children
    - Default non-DOM merge function will merge the children-independent sink together with the
    children sinks via simple stream merge (i.e. `Rx.Observable.merge`)

# Examples
In this section, we are going to show miscellaneous examples of use of componentization with the
`m` factory.
Most of those examples will be inspired from already-existent UI component library, such as
`Semantic UI`.

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
maintainability, the created events should be coupled to the DOM representation generated by the
children component. There is however no enforcement of such property.
The created events will be mixed with the sinks returned from the children components.

Contracts:
- an event sink generated from event sources MUST NOT conflict with a sink with the same key from
the children component
- there MUST be an `events` property in the settings object. The corresponding object MAY be
empty (event factory created no events).

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
`events.DOM` is a list of selectors that MAY be later used in the children components,
for instance to uniquely identify the target of an event. This allow to parameterize the coupling
between the parent and the children components, i.e. between the events and the event targets.
`events.DOM` is also used to set an event listener on the matching DOM element (as specified by
`selector`). Corresponding listened-to events will be streamed through a sink with identifier
`[selectorDesc]_[DomEventName]`.

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
children (through settings), children components can reference within their DOM tree the passed
on selector (`settings.events.DOM.click.PriceSelector`). Repetition is avoided and the
coupling of behaviour and visual representation is made explicit.

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
TODO : implement, include a link to the code on github, and excerpts from it with `...` for low
relevant part of the code, maybe explain a bit or better do that in the source code in fact.
Include a link to the tests

## Button component
`Button = m(ButtonComponentSpec, ButtonComponentSettings, childrenComponents)`
`Button = mButton(ButtonComponentSettings, childrenComponents)`

This example makes use of :
- `checkPreConditions`
- `makeOwnSinks`
- default merge of sinks (DOM and non-DOM sinks)

### Description
The button component is a `<div>` that will behave like a button, according to the parameters
specified in settings. Cf. `semanticUI` documentation for a description of the settings properties.

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
TODO : implement, include a link to the code on github, and excerpts from it with `...` for low
relevant part of the code. That means include ButtonComponentSpec as comments in the source code

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
- should make `localSettings`, settings which are only applied locally, i.e. for `makeOwnSinks`,
and not passed down to the children. That would allow to customize those own sinks as a function
of the settings from construction time (inherited from parent and ancestors) at runtime. Settings
 for now are inherited as `parent <- grand parent <- ... patriarch`.

Bibliography
Brooks, Fred P. (1986). "No Silver Bullet — Essence and Accident in Software Engineering". Proceedings of the IFIP Tenth World Computing Conference: 1069–1076

Ernst, Erik. "Separation of concerns." Proceedings of the AOSD 2003 Workshop on Software-Engineering Properties of Languages for Aspect Technologies (SPLAT), Boston, MA, USA. 2003.
https://pdfs.semanticscholar.org/c052/f9d0e7e4c89a9d7abd36ffed4051ec59bb64.pdf
