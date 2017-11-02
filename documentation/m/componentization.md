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


# Annex

## API

### m

The `m` helper function creates a component from some definition parameters and children components. 

The `m` helper function is a generalization of the `h` helper which generates a vNode tree by expliciting the process which builds that tree.

For instance, with `h`, one can write :

```javascript
var vnode = h('div', {style: {color: '#000'}}, [
  h('h1', 'Headline'),
  h('p', 'A paragraph'),
]);
```
In a typical cyclejs application, we commonly manipulate components which are functions with the signature `:: Sources -> Sinks` where `Sources` and `Sinks` are a hash of observables indexed by the observable names. 

At a component level,  we often find ourselves repeating the same operations over and over to express our components. The general pattern for expressing a component is the following :

`parentComponent(sources) = f(childrenComponents)(sources)`

where in `f` we:

- possibly add sources for the children consumption
	- some of these sources are actual observables, i.e. a sequence of values over time
	- some of these sources are actual values (settings) lifted into an observable, to respect the function signature
- possibly make some computation proper to the parent component, which outputs some parent sinks
- retrieve the sinks from the children components
- merge parents sinks and children sinks somehow into the final sinks which are returned

The `m` helper is a factoring of that process, where the operations realized to compute the final component sinks are segregated into properties (which are functions) with a single concern. Also, the `m` helper separates settings from sources, as they are semantically distinct.


#### Signature

 - `Component :: Sources -> Settings -> Sinks`
 - `m :: Opt ComponentDef -> Opt Settings -> [Component] -> Component`, where :
	 - `ComponentDef :: Record ( makeLocalSources, makeLocalSettings, makeOwnSinks, mergeSinks, sourcesContract, sinksContract)`, where :
		 - `makeLocalSources :: Sources -> Settings -> Sources`
		 - `makeLocalSettings :: Settings -> Settings`
		 - `makeOwnSinks :: Sources -> Settings -> Sinks`
		 - `mergeSinks :: Sinks -> [Sinks] -> Settings -> Sinks`
		 - `sourcesContract :: Sources -> Boolean`
		 - `sinksContract :: Sinks -> Boolean`
 - with the following algorithm:
	- compute extra sources (`makeLocalSources` 
		- NOTE: in our source code, the function `Fetch` is often used to that purpose)
	- compute extra settings (`makeLocalSettings`)
	- compute parent sinks with extra sources, and extra settings (`makeOwnSinks`)
	- compute children sinks with extra sources and extra settings (`[Component]`)
	- merge parent and children sinks into final component sinks (`mergeSinks`)
		- NOTE: in our source code, ``combineDOMToDivs` or `mergeWithFlatMapLatest`is often used to that purpose
	- the sources and sinks contracts can be used to do type checking and any source validation rules relevant to the component (for instance, checking presence of sources which are mandatory for the good behavior of the component)

For an example of translating a normal component into the `m` syntax, have a look [here](#mExample).

#### Diagram
The innerworkings of the `m` helper can be summarized by the following diagram :

![m algorithm diagram](http://i.imgur.com/nZejFxz.png))

#### Example from current source code

##### `EngagementItem.js`
Simplest example I could find to showcase the use of `makeLocalSources`. 

```javascript
const _label = ({isApplied, isAccepted, isConfirmed}) =>
  isConfirmed && 'Confirmed' ||
    isAccepted && 'Accepted' ||
      isApplied && 'Applied' ||
        'Unknown'

const _Fetch = sources => {
  const opp$ = sources.item$.pluck('oppKey')
    .flatMapLatest(Opps.query.one(sources))
  const project$ = opp$.pluck('projectKey')
    .flatMapLatest(Projects.query.one(sources))
    .combineLatest(
      opp$.pluck('projectKey'),
      (p, $key) => ({$key, ...p})
    )
  return {
    opp$,
    project$,
  }
}

const EngagementItem = sources => {
  const _sources = {...sources, ..._Fetch(sources)}
  return ProjectItem({..._sources,
    subtitle$: combineLatest(
      _sources.item$, _sources.opp$,
      (e,opp) => opp.name + ' | ' + _label(e)
    ),
    item$: _sources.project$,
    path$: _sources.item$.map(({$key}) => '/engaged/' + $key),
  })
}
```

would become :

```javascript
const EngagementItem = m({
  makeLocalSources: (sources, settings) => {
    const opp$ = sources.item$.pluck('oppKey')
        .flatMapLatest(Opps.query.one(sources))
    const project$ = opp$.pluck('projectKey')
        .flatMapLatest(Projects.query.one(sources))
        .combineLatest(
            opp$.pluck('projectKey'),
            (p, $key) => ({$key, ...p})
        )
    const subtitle$ = combineLatest(
        sources.item$, opp$,
        (e, opp) => opp.name + ' | ' + _label(e)
    )
    const item$ = project$
    const path$ = sources.item$.map(({$key}) => '/engaged/' + $key)
    
    return {
      opp$,
      project$,
      subtitle$,
      item$,
      path$
    }
  }
}, {}, [ProjectItem])
```

##### `ProfileInfo.js`
Simplest example I could find to showcase the use of `makeOwnSinks`, `makeLocalSources` and a component tree with a depth > 1.

```javascript
const Avatar = sources => MediumProfileAvatar({...sources,
  profileKey$: sources.engagement$.map(prop('profileKey')),
})

const PersonalInfo = sources => {
  const email = ListItem({...sources,
    title$: sources.profile$.map(prop('email')), subtitle$: of('Email')})
  const phone = ListItem({...sources,
    title$: sources.profile$.map(prop('phone')), subtitle$: of('Phone')})
  const intro = ListItem({...sources,
    title$: sources.profile$.map(propOr('No intro written', 'intro')),
    classes$: of({quote: true})})

  return {
    DOM: combineDOMsToDiv('.col-xs-8', intro, email, phone),
  }
}

const ProfileInfo = sources => ({
  DOM: of(div([
    combineDOMsToDiv('.row',
      Avatar(sources),
      PersonalInfo(sources),
    ),
  ])),
})

```

would become

```javascript
ProfileInfo = m({
  makeOwnSinks: (sources, settings) => ({DOM: $.of(div('.row'))}),
  mergeSinks: mergeSinksDefault
}, {}, [Avatar, PersonalInfo])
```

Because of the automatic use of defaults functions when properties are not specified, the following would actually be enough :
```javascript
ProfileInfo = m({
  makeOwnSinks: (sources, settings) => ({DOM: $.of(div('.row'))}),
}, {}, [Avatar, PersonalInfo])
```

`Avatar` and `PersonalInfo` could remain in the same form, or they could be further broken down into a `m` form.

The latter would result in, as a whole :

```javascript
ProfileInfo = m({
  makeOwnSinks: (sources, settings) => ({DOM: $.of(div('.row'))}),
}, {}, [Avatar, PersonalInfo])

Avatar = m({
  makeLocalSources: sources => ({
    profileKey$: sources.engagement$.map(prop('profileKey'))
  })
}, {}, [MediumProfileAvatar])

EmailListItem = m({
  makeLocalSources: sources => ({
    title$: sources.profile$.map(prop('email'))
  })
}, {subtitle: 'Email'}, [ListItem])

PhoneListItem = m({
  makeLocalSources: sources => ({
    title$: sources.profile$.map(prop('phone'))
  })
}, {subtitle: 'Phone'}, [ListItem])

IntroListItem = m({
  makeLocalSources: sources => ({
    title$: sources.profile$.map(propOr('No intro written', 'intro'))
  })
}, {classes: {quote: true}}, [ListItem])

PersonalInfo = mdiv('.col-xs-8', [EmailListItem, PhoneListItem, IntroListItem])
```
The same as `h` comes with hyperscript functions `div`, `span`, etc., we have introduced here a `mdiv` function which is simply a shortcut : 

`mdiv (selector, children) = m({makeOwnSinks: sources => {DOM : $.of(div(selector}}, {}, children)`

##### `EngagementNav.js`
We have seen the use of the `m` helper for components with only a DOM sink, and how it allows to express the component tree is a straightforward manner. 
The major interest of `m` however lies in the default merge of any sinks computed by components, which allows to intertwin `vNode` tree with any sink tree.

```javascript
const EngagementNav = sources => {
  const glance = isolate(ListItemNavigating,'glance')({...sources,
    title$: just('At a Glance'),
    iconName$: just('home'),
    path$: just('/'),
  })
  const app = isolate(ListItemNavigating,'app')({...sources,
    title$: just('Your Application!'),
    iconName$: just('event_note'),
    path$: just('/application'),
  })

  const listDOM$ = combineLatest(glance.DOM, app.DOM, (...doms) => doms)

  const route$ = merge(glance.route$, app.route$)
    .map(sources.router.createHref)

  const DOM = combineLatest(
    sources.isMobile$,
    sources.titleDOM,
    listDOM$,
    (isMobile, titleDOM, listDOM) =>
      div({}, [
        isMobile ? null : titleDOM,
        div('.rowwrap', {style: {padding: '0px 15px'}}, listDOM),
      ])
  )

  return {
    DOM,
    route$,
  }
}

```

would become :

```javascript
  AtaGlance = m({},
    {isolate: 'glance', title: 'At a Glance', iconName: 'home', path: '/'},
    [ListItemNavigating])
    
  YourApplication = m({},
    {isolate: 'app', title: 'Your Application', iconName: 'event_note', path: '/application'},
    [ListItemNavigating])
    
  EngagementNav = m({
    makeOwnSinks: sources => ({
      isMobile$: sources.isMobile$,
      titleDOM: sources.titleDOM
    }),
    mergeSinks: (ownSinks, childrenSinks, settings) => {
      const sinkNames = getSinkNames(childrenSinks)
      let sinks = {}
      sinkNames.forEach(sinkName => {
        switch (sinkName) {
          case 'DOM':
            sinks[sinkName] = $.combineLatest(
              [ownSinks.isMobile$, ownSinks.titleDOM].concat(projectOnDOM(childrenSinks)),
              ([isMobile, titleDOM, ...listDOM]) =>
                div({}, [
                  isMobile ? null : titleDOM,
                  div('.rowwrap', {style: {padding: '0px 15px'}}, listDOM),
                ])
            )
            break
          default:
            sinks[sinkName] = mergeNonDomSinkDefault(null, childrenSinks, sinkName)
            break
        }
      })
      
      return sinks
    }
  }, {}, [AtaGlance, YourApplication])

```

(minor implementation details left aside)

#### Roadmap
To match the `h` hyperscript and have an API which allows for shorter code :

- `mdiv`, `mspan`, `mbutton`, etc.
- have a configurable default merge function for each sink
	- `defaultMerge :: sinkName -> (Sinks -> [Sinks] -> Settings -> Sink)`
- have a `mergeDefaultSinks` which automatically apply the default merges :
	- `mergeDefaultSinks :: Sinks -> [Sinks] -> Settings -> Sinks`
- add most relevant component combinators (m version and hyperscript version)
	- DONE : routing
	- WIP : switching
	- WIP : auth (in principle, special case of switching)
	- TODO : iterating
	- TODO : eventing

With predefined defaults and component combinators, it will be possible to write the application as a component tree x combinators x merging functions, with few non-default merging functions to be specified explicitly.

## Routing

TODO : documentation explaining API, nesting, and settings scoping

## TODO

- integrate testing helper in new env:
  - means a run unit test kind of things
- integrate m helper
	- switch to most
	- integrate testing
	- LATER : define typings for it
- integrate router
	- switch to most
	- move to history v4
		- test history driver with new API
		- adjust typings for route source, route sink and route driver
		- NOW : testing new history driver, in particular the location object construction
- integrate switcher
	- switch to most
	- integrate testing too
- use switcher, router, m to get landing page done.
		- 

