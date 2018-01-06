# The case for a component combinator library ![](https://img.shields.io/badge/license-MIT-blue.svg)
This component combinator library comes from some pain points I experimented while dealing with implementing interactive applications, which make heavy use of streams and try to use componentization :

- the stream plumbery between components is hard to read and make sense of
  - this is specially true with deep and large reactive graphs
  - and when you have to process mentally miscellaneous level of `flatMap`
- achieving reusability through parameterization leads to more in-your-face stream gymnastic 
    - using `prop$` to pass properties can become unwieldy when there are a lot of properties involved

The application under development should be expressed as simply or as complex as it is per its design, while keeping the stream complexity at a lower layer. 

Let's see some examples.

## Login gateway
For instance, the structure behind a login section of an application goes as such:

```javascript
export const App = Switch({
  on: convertAuthToIsLoggedIn,
  sinkNames: ['auth$', DOM_SINK, 'router'],
  as : 'switchedOn',
  trace: 'Switch'
}, [
  Case({ when: IS_NOT_LOGGED_IN, trace: 'LoginPage Case' }, [
    LoginPage({ redirect: '/component-combinators/examples/SwitchLogin/index.html?_ijt=7a193qn02ufeu5it8ofa231v7e' })
  ]),
  Case({ when: IS_LOGGED_IN, trace: 'MainPage Case' }, [
    MainPage
  ]),
]);

```

and translates the simple design :

- Functional specifications
    - if user is logged, show the main page
    - if user is not logged, show the login page, and redirect to `index` route when login is performed
- Technical specifications
    - `MainPage` takes the concern of implementing the main page logic.
    - `LoginPage` is parameterized by a redirect route, and is in charge of logging in the user
    - `convertAuthToIsLoggedIn` emits `IS_NOT_LOGGED_IN` or `IS_LOGGED_IN` according to whether the user is logged or not
    
The stream switching logic is hidden behind the `Switch` combinator.

## Nested routing
The following implementation corresponds to :

- Functional specifications
    - user visits '/' -> display home page
        - home page allows to navigate to different sections of the application
    - when the user visit a given section of the application
        - a breadcrumb shows the user where he stands in the sitemap
        - a series of clickable cards is displayed
            - when the user clicks on a given card, details about that card are displayed, and corresponding to a specific route for possible bookmarking
- Technical specifications
    - `HomePage` takes the concern of implementing the home page logic.
    - `Card` is parameterized by its card content, and is in charge of implementing the card logic
    - `CardDetail` is parameterized by its card content, and is in charge of displaying the extra details of the card

```javascript
export const App = InjectSourcesAndSettings({
  sourceFactory: injectRouteSource,
  settings: {
    sinkNames: [DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE,
    trace: 'App'
  }
}, [
  OnRoute({ route: '', trace: 'OnRoute (/)' }, [
    HomePage
  ]),
  OnRoute({ route: 'aspirational', trace: 'OnRoute  (/aspirational)' }, [
    InjectSourcesAndSettings({ settings: { breadcrumbs: ['aspirational'] } }, [
      AspirationalPageHeader, [
        Card(BLACBIRD_CARD_INFO),
        OnRoute({ route: BLACK_BIRD_DETAIL_ROUTE, trace: `OnRoute (${BLACK_BIRD_DETAIL_ROUTE})` }, [
          CardDetail(BLACBIRD_CARD_INFO)
        ]),
        Card(TECHX_CARD_INFO),
        OnRoute({ route: TECHX_CARD_DETAIL_ROUTE, trace: `OnRoute (${TECHX_CARD_DETAIL_ROUTE})` }, [
          CardDetail(TECHX_CARD_INFO)
        ]),
        Card(TYPOGRAPHICS_CARD_INFO),
        OnRoute({
          route: TYPOGRAPHICS_CARD_DETAIL_ROUTE,
          trace: `OnRoute (${TYPOGRAPHICS_CARD_DETAIL_ROUTE})`
        }, [
          CardDetail(TYPOGRAPHICS_CARD_INFO)
        ]),
      ]])
  ]),
]);
```

The nested routing switching logic is hidden behind the `OnRoute` combinator.

## Dynamically changing list of items

The following implementation corresponds to :

- Functional specifications
    - display a list of cards reflecting input information from a card database
    - a pagination section allows to display X cards at a time
- Technical specifications
    - `Card` is parameterized by its card content, and is in charge of implementing the card logic
    - `Pagination` is in charge of the page number change logic

```javascript
export const App = InjectSources({
  fetchedCardsInfo$: fetchCardsInfo,
  fetchedPageNumber$: fetchPageNumber
}, [
  ForEach({
      from: 'fetchedCardsInfo$',
      as: 'items',
      sinkNames: [DOM_SINK],
      trace: 'ForEach card'
    }, [AspirationalPageHeader, [
      ListOf({ list: 'items', as: 'cardInfo', trace: 'ForEach card > ListOf' }, [
        EmptyComponent,
        Card,
      ])
    ]]
  ),
  ForEach({
    from: 'fetchedPageNumber$',
    as: 'pageNumber',
    sinkNames: [DOM_SINK, 'domainAction$']
  }, [
    Pagination
  ])
]);

```

The iteration logic are taken care of with the `ForEach` and the `ListOf` combinators.

# Combinators
## Syntax
In general combinators follow a common syntax : 

- `Combinator :: Settings -> ComponentTree -> Component`
    - `Component :: Sources -> Settings -> Sinks`
    - `ComponentTree :: ChildrenComponents | [ParentComponent, ChildrenComponents]`
    - `ParentComponent:: Component`
    - `ChildrenComponents :: Array<Component>`

## Combinator list
The proposed library has the following combinators :

| Combinator      | Description | 
| --------- | :-----|
| [FSM](http://brucou.github.io/projects/component-combinators/efsm/)      |    Activate components based on inputs, and current state of a state machine. Allows to implement a flow of screens and actions according to complex control flow rules.  |
| [OnRoute](http://brucou.github.io/projects/component-combinators/router/)      |    Activate a component based on the route changes. Allows nested routing. |
| [Switch](http://brucou.github.io/projects/component-combinators/switch/)  | Activate component(s) depending on the incoming value of a source| 
| [ForEach](http://brucou.github.io/projects/component-combinators/foreach/)     |   Activate component for each incoming value of a source| 
| [ListOf](http://brucou.github.io/projects/component-combinators/listof/)      |    Activate a list of a given component based on an array of items |
| [Pipe](https://brucou.github.io/projects/component-combinators/pipe/)      |    Sequentially compose components |
| [InjectSources](http://brucou.github.io/projects/component-combinators/injectsources/)      |    Activate a component which will be injected extra sources |
| [InjectSourcesAndSettings](http://brucou.github.io/projects/component-combinators/injectsourcesandsettings/)      |    Activate a component which will receive extra sources and extra settings |
| [InSlot](https://brucou.github.io/projects/component-combinators/inslot/) | **TODO documentation**|
| [m](http://brucou.github.io/projects/component-combinators/mm/)      |    The core combinator from which all other combinators are derived. m basically traverses a component tree, applying reducing functions along the way.  |

Documentation, demo and tests for each combinator can be found in its respective repository.

# Background
The theoretical underpinnings can be found as a series of articles on my [blog](https://brucou.github.io/) :

- [user interfaces as reactive systems](https://brucou.github.io/posts/user-interfaces-as-reactive-systems/)
- [componentization against complexity](https://brucou.github.io/posts/componentization-against-complexity/)
- [a componentization framework for cyclejs](https://brucou.github.io/posts/a-componentization-framework-for-cyclejs/)
- [applying componentization to reactive systems : sample application](https://brucou.github.io/posts/applying-componentization-to-reactive-systems---sample-application/)

# Documentation
Documentation can be found in the [projects portion](https://brucou.github.io/projects/component-combinators/) of my blog.

# Roadmaps
## Roadmap v0.5
The core target of this release will be to prepare the architecture for visual tracing, and 
specify the (visual) shape that this should take. A small proof of concept should be produced. A 
secondary target is to start a very basic UI component library, not going over the proof of 
concept level.

The current roadmap for the v0.5 stands as :

- Core
    - [ ] type contracts error handling for component's settings
    - [ ] error management
    - [ ] logging and visualization (!)
- Component library
  - [ ] a small one with the basics - should be able to copy a lot from react?
    - so many of them, https://bosonic.github.io/elements/dialogs-modals.html, cf. 
    materializecss, etc.
- Demo
  - [ ] demo from Angular2 book on github site
  - [ ] [Real world app?](https://github.com/gothinkster/realworld)
- Testing
    - [ ] Model-based testing for FSM, i.e. automatic test cases generation
    - [ ] study testing with pupeeteer.js (chrome headless browser)
- Combinators
    - [ ] Switch combinator 
      - [ ] cover the `default:` part of switch statement 
    - [ ] State machine combinator `FSM`
      - [ ] convert FSM structure to graphml or dot or tgf format
      - [ ] automatic generation of graphical representation of the FSM
      - [ ] refactor the asynchronous FSM into synchronous EHFSM + async module
        - this adds the hierarchical part, improvement in core library are automatically translated in improvement to this library, and closed/open principle advantages
      - [ ] investigate prior art
        - https://github.com/jbeard4/SCION
        - http://blog.sproutcore.com/statecharts-in-sproutcore/ 
    - [ ] Event combinator `WithEvents`
    - [ ] State combinator `WithActions`
    - [ ] Action combinator `ComputeActions`
- Distribution
  - [ ] monorepo?
  - [ ] individual combinator packages?

## Roadmap v0.4
Please note that library is still wildly under development :

- APIs ~~might~~ will go through breaking changes
- you might encounter problems in production
- performance has not been investigated as of yet

The current roadmap for the v0.4 stands as :

- Core
    - [x] component model
    - [x] DOM merge with slot assignment (a la web component)
    - [x] documentation slot
      - [non-technical](https://css-tricks.com/intro-to-vue-2-components-props-slots/), or 
     https://skyronic-Demo.com/blog/vue-slots-example 
    - [x] documentation combinators
    - [x] nice blog site : github pages?
      - [x] select static site generator (Jekyll, Hexo, Hugo)
      - [x] blog site architecture
      - [x] theoretical underpinnings
    - [x] demo from Angular2 book
- Testing
    - [x] Testing library `runTestScenario`
    - [x] Mocks for DOM and document driver
    - [x] Mock for domain query driver
- Combinators
    - [x] Generic combinator `m`
    - [x] Routing combinator `onRoute`
    - [x] Switch combinator 
      - [x] `Switch`
      - [x] `Case`
    - [x] State machine combinator `FSM`
    - [x] ForEach combinator `ForEach`
    - [x] List combinator `ListOf`
    - [x] Injection combinator 
      - [x] `InjectSources`
      - [x] `InjectSourcesAndSettings`
    - [x] Query driver 
    - [x] Action driver 
    - [x] sequential composition combinator (`Pipe`)

# Installation
## Running tests
- `npm install`
- `npm run node-build-test`
- `npm run test`
- then open with a local webserver the `index.html` in `test` directory 
  
## Demos
### Example application
The example application is taken from the book [Mastering Angular2 components](https://www.packtpub.com/web-development/mastering-angular-2-components). Cf. [screenshot](https://brucou.github.io/posts/a-componentization-framework-for-cyclejs/#example) here.

- sits in `examples/AllInDemo` directory
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/AllInDemo` directory 

### State Machine
- go to `$HOMEDIR/examples/volunteerApplication`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/volunteerApplication` directory 

### Switch
- go to `$HOMEDIR/examples/SwitchLogin`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/SwitchLogin` directory

### OnRoute
- go to `$HOMEDIR/examples/NestedRoutingDemo`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/NestedRoutingDemo` directory

### ForEach and List
- go to `$HOMEDIR/examples/ForEachListDemo`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/ForEachListDemo` directory

# Contribute
Contribution is welcome in the following areas :

- devops
  - monorepos
  - whatever makes sense to make the repository more manageable
- reducing build size

# Known issues
TODO review this, it has changed
- type safety.
  we have seen how components are combined through component combinators. type of what is in the
  sinks, should propagate through prisms up but we don't have that, so we let anything flow.
  Advantage is we wrote a very generic merge function
- expressivity allowed by the syntax
  - For instance, nothing prevents `NavigationSection({},
  [NavigationSection({), [NavigationItem]])` would not give the expected result
    - or would it?
- syntax checking
  - `NavigationSection` could be only permitted to have `NavigationItem` as children or nest other `NavigationSection` and we would not be able to check that the parameters are in line with the
  expected syntax
