![](https://img.shields.io/badge/license-MIT-blue.svg)

# Motivation 
Around 18 months ago, while working on what is the largest cyclejs codebase I know of 
(~20K lines of javascript), I realized how hard it was to actually make sense and maintain a 
large cycle-js application. Focusing on those issues derived from cyclejs usage :

- a large portion of the code was stream handling originating from the use of components and the 
necessity to wire them together. The domain logic, and as a result, **the application logic was 
lost** into a sea of streams' sometimes-cryptic operations. 
- extra confusion about inputs (sources), their meanings and usage, due to **inputs addressing two 
separate concerns** : component parameterization and interfacing with external systems. A bunch of 
constants were lifted into streams in miscelleanous places to serve as parameters for generic 
components, and that led to more stream arithmetic, noise, and in some occurences bugs
- **modifying, fixing and extending that code proved to be a gamble**, with any bug fixing or 
debugging sessions counted in hours. To be fair, the complete absence of documentation (and tests) explained a lot of 
that). The absence of unit tests itself could be explained itself by, well, the **pain** that it 
is to write them with streams in the middle, which led to resorting to sometimes 
brittle, often slow, selenium-based end-to-end tests.
- hard to figure out **quickly, with certainty** the exact workflow that the application was 
implementing (you know, multi-step processes where any step may fail and you need to backtrack), let
 alone add new logical branches (error recovery...)

And yet, while that application was large, it cannot really be said to be an exceptionally complex 
application. Rather it was the standard CRUD application which is 90% of business applications today. No fancy animations, adaptive ui as the only ux trick, otherwise mostly fields and forms, a remote database, and miscellaneous domain-driven workflows.

This was the motivation behind my dedicating my (quite) limited free time to add the missing 
capabilities to the framework. I singled out those four areas : 
 componentization, visual debugging, testing, concurrency control. I am happy that finally the 
 first step is in a sufficient state of progress that it can be shared. 
 
 **That first step is a componentization model for cyclejs**, that builds upon the original idea 
 of a component as a function and extends it further. Components are (mostly) what they used to 
 be. Components can however now be parameterized through a dedicated argument `settings`, 
 capturing the **component's parameterization concern**, and which is inherited down the component 
 tree. Components, importantly, can be built through a series of **component combinators** which eliminate a lot of stream noisy, repetitive code. Those
  component combinators have been extracted and  abstracted from the 20K lines of code, so they should cover a large number of cases that one 
  encounters. The proposed component model could be seen in many ways as a **generalization of that
   of `React`**, extending it to handle concerns other than the view, which opens the door to using a `JSX`-like syntax if you so fancy. The component model also sets up the work for tracing and visualization tools for the second step, **without any 
  modification of cyclejs internals.** 

This is really a working draft, akin to a proof of concept. Performance was not at all looked upon, 
combinators only work with rxjs, the version of cycle used brings us back to the time 
when cyclejs could still be considered a library (vs. a framework), build is not optimized, 
`console.log`s are all over the place, **only tested on chrome evergreen**, etc. 

It works nicely though. It succeeds in providing a **higher-level abstraction** so you can focus on 
the **interdependence** of components that defines the user interface **logic**, rather than having
 to constantly fiddle with a large amount of **implementation details**. 

Each combinator features (and if not, will feature) a dedicated non-trivial example of use, and is 
documented and tested. A sample application is available to showcase how combinators work 
together with components to build a non-trivial application.

**A series of articles covers the theoretical underpinning** in more details (read 
chronologically, they constitute a long read, but I think they are very interesting). A [specific article](http://brucou.github.io/posts/applying-componentization-to-reactive-systems---sample-application/) shows the 
step-by-step building of the show-cased sample application. A shorter introduction can be found in the `README` for the repository. 

Let's now see some examples of use.

## Login gateway
For instance, the structure behind a login section of an application goes as such:

```javascript
export const App = Switch({
  on: convertAuthToIsLoggedIn,
  as : 'switchedOn',
}, [
  Case({ when: IS_NOT_LOGGED_IN }, [
    LoginPage({ redirect: '/component-combinators/examples/SwitchLogin/index.html?_ijt=7a193qn02ufeu5it8ofa231v7e' })
  ]),
  Case({ when: IS_LOGGED_IN }, [
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

![login demo with Switch combinator](examples/SwitchLogin/assets/login_demo.gif)

The same code could be written in a `JSX`-like dialect as :

```javascript
export const App = 
  <Switch on=convertAuthToIsLoggedIn as='switchedOn'>
      <Case when=IS_NOT_LOGGED_IN>
        <LoginPage redirect='/component-combinators/examples/SwitchLogin/index.html?_ijt=7a193qn02ufeu5it8ofa231v7e'/>
      </Case>
      <Case when=IS_LOGGED_IN>
        <MainPage\/>
      </Case>
  </Switch>
```

The same code could also be written in a dedicated DSL :

```javascript
export const App = dsl`
  Switch On ${convertAuthToIsLoggedIn} (As switchedOn)
    When ${IS_NOT_LOGGED_IN} :
      LoginPage {redirect:'/component-combinators/examples/SwitchLogin/index.html?_ijt=7a193qn02ufeu5it8ofa231v7e'}
    When ${IS_LOGGED_IN} :
      MainPage
`
```

Syntax, whichever chosen (we will work only with the first one) is but a detail. 
What is important here is that :

- the stream wiring concern has disappeared within the `Switch` combinator (i.e. has been 
abstracted out), while the user interface logic can be written in a way which is very close to its specification, hence easier to 
understand and check for correctness 
- The developer cannot make any mistake in the stream switching logic, nor 
does he have to check while debugging that the error does not come from an erroneous switch 
handling. Provided that the `Switch` combinator has been properly implemented and tested, the 
corresponding concern is out of the way.
- A debugging developer can narrow down a cause of misbehaviour for example by selectively 
modifying arguments, deleting branches of the component tree, stubbing components, etc. That is, reasoning, investigating can be made at a component level first, before, if necessary, going at the lower stream level.

Let's seee another example.

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
  }
}, [
  OnRoute({ route: '' }, [
    HomePage
  ]),
  OnRoute({ route: 'aspirational' }, [
    InjectSourcesAndSettings({ settings: { breadcrumbs: ['aspirational'] } }, [
      AspirationalPageHeader, [
        Card(BLACBIRD_CARD_INFO),
        OnRoute({ route: BLACK_BIRD_DETAIL_ROUTE }, [
          CardDetail(BLACBIRD_CARD_INFO)
        ]),
        Card(TECHX_CARD_INFO),
        OnRoute({ route: TECHX_CARD_DETAIL_ROUTE }, [
          CardDetail(TECHX_CARD_INFO)
        ]),
        Card(TYPOGRAPHICS_CARD_INFO),
        OnRoute({
          route: TYPOGRAPHICS_CARD_DETAIL_ROUTE,
        }, [
          CardDetail(TYPOGRAPHICS_CARD_INFO)
        ]),
      ]])
  ]),
]);
```

![animated demo](examples/NestedRoutingDemo/assets/nested_routing_demo.gif)

The (gory) nested routing switching logic is hidden behind the `OnRoute` combinator. With that out
 of the way, the routing logic can be expressed very naturally (in a very similar way to React 
router's [dynamic routing](https://reacttraining.com/react-router/core/guides/philosophy/dynamic-routing), in which the router is a component 
like any other). There is no pre-configuration of routes, outside of the application. Routes are 
directly and naturally included in their context.

Let's attack dynamic lists.

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
    }, [AspirationalPageHeader, [
      ListOf({ list: 'items', as: 'cardInfo' }, [
        EmptyComponent, // Component activated in case list is empty
        Card, // // Component activated otherwise
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

![ForEachList demo](examples/ForEachListDemo/assets/images/animated_demo.gif)

The reactive update (on `fetchedCardsInfo$`) and iteration logic (on the array of items received 
from `fetchedCardsInfo$`) are taken care of with the `ForEach` and the `ListOf` combinators.

While the full syntax and semantics of the component combinators haven't been exposed, hopefully 
the examples serve to portray the merits of using a component model, under which an application
 is written as a component tree, where components are glued with component combinators. I certainly 
think it is simpler to write, and more importantly, simpler to read, maintain and debug.

Let's have a proper look at combinators' syntax and the available combinators extracted from the 
20K-line cyclejs codebase.
 
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
| [FSM](http://brucou.github.io/projects/component-combinators/efsm---example-application/)      |    Activate components based on inputs, and current state of a state machine. Allows to implement a flow of screens and actions according to complex control flow rules.  |
| [OnRoute](http://brucou.github.io/projects/component-combinators/router/)      |    Activate a component based on the route changes. Allows nested routing. |
| [Switch](http://brucou.github.io/projects/component-combinators/switch/)  | Activate component(s) depending on the incoming value of a source| 
| [ForEach](http://brucou.github.io/projects/component-combinators/foreach/)     |   Activate component for each incoming value of a source| 
| [ListOf](http://brucou.github.io/projects/component-combinators/listof/)      |    Activate a list of a given component based on an array of items |
| [Pipe](https://brucou.github.io/projects/component-combinators/pipe/)      |    Sequentially compose components |
| [InjectSources](http://brucou.github.io/projects/component-combinators/injectsources/)      |    Activate a component which will be injected extra sources |
| [InjectSourcesAndSettings](http://brucou.github.io/projects/component-combinators/injectsourcesandsettings/)      |    Activate a component which will receive extra sources and extra settings |
| [InSlot](https://brucou.github.io/projects/component-combinators/inslot/) | Assign DOM content to a slot|
| [m](http://brucou.github.io/projects/component-combinators/mm/)      |    The core combinator from which all other combinators are derived. `m` (for *merge*) basically traverses a component tree, applying default or provided reducing functions along the way.  |

Documentation, demo and tests for each combinator can be found in its respective repository.

# Theoretical background
The theoretical underpinnings can be found as a series of articles on my [blog](https://brucou.github.io/) :

- [user interfaces as reactive systems](https://brucou.github.io/posts/user-interfaces-as-reactive-systems/)
- [componentization against complexity](https://brucou.github.io/posts/componentization-against-complexity/)
- [a componentization framework for cyclejs](https://brucou.github.io/posts/a-componentization-framework-for-cyclejs/)
- [applying componentization to reactive systems : sample application](https://brucou.github.io/posts/applying-componentization-to-reactive-systems---sample-application/)
- [Component models for user interfaces implementation - a comparison](http://brucou.github.io/posts/component-models-for-user-interfaces-implementation---a-comparison/)

# Documentation
Documentation can be found in the [projects portion](https://brucou.github.io/projects/component-combinators/) of my blog.

# Installation
## Packages
The following packages are available :

| Package          | Description                                                                                                                          |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| @rxcc/components | Contains the core component combinators                                                                                              |
| @rxcc/drivers    | Exposes a few useful drivers, in particular drivers to handle command and queries on a domain, and read the DOM state                |
| @rxcc/testing    | Mocks for the provided drivers, and the testing library used for testing the components combinators                                  |
| @rxcc/contracts  | A bunch of predicates and utility functions to handle contract checking and assertions                                               |
| @rxcc/utils      | Miscellaneous utility functions (debugging, component helpers, etc.) |
|                  |                                                                                                                                      |

Any of those can be installed with `npm`. For instance :

```javascript
npm install @rxcc/components
```
 
 # Tests
 Tests are performed with `QUnit`, i.e. in the browser. This allows debugging code in the browser, and 
 also the possbility in a debugging session to actually display some components' output directly in 
 the DOM (vs. looking at some virtual representation of the DOM). To run the available tests, in 
 the root directory, type : 
 
 - `npm install`
 - `npm run build-node-test`
 - have a look at `/test/index.js` to pick up which test you want to run
 - `npm run test`
 - then open with a local webserver the `index.html` in `test` directory 

# Roadmaps

<details>
  <summary>Roadmap v0.5</summary>

The core target of this release will be to prepare the architecture for visual tracing, and 
specify the (visual) shape that this should take. A small proof of concept should be produced. A 
secondary target is to start a very basic UI component library, not going over the proof of 
concept level.

The current roadmap for the v0.5 stands as :

- Core
    - robustness of settings :
      - in some cases, should be inherited down the tree, in other cases should be private (find 
      a nice syntax). That creates complexity but reduces bug surface so worth it.
      - very important bug which is facilitated as of now : a settings could be set at some 
      location in the tree, and then read wrongly at another location of the tree because they 
      have the same name. that prevents from using default values for settings, the default value
       could be wrongly overridden by settings inherited from up the tree.
         - as of now, expected settings MUST be mandatory and SHOULD be namespaced to avoid 
         collisions
    - external system's state reading
      - [ ] `document` driver reads synchronously a **value** from the DOM. That is possible 
      because DOM database is **local**. Value whether to uniformize read mechanism by having them 
      all returning `Observable`. That should enable **simpler** tracing!!
    - see what can be done to have a better concurrency model (i.e. beyond FSM)
    - [ ] type contracts error handling for component's settings (which types of component 
    combinator expects, types of settings, etc.)
    - error management : 
      - [ ] [error boundaries?](https://reactjs.org/docs/error-boundaries.html)
      - [ ] error logging (use chrome's console.context? replace string formatting for console?)
    - [ ] logging and visualization (!)
    - [ ] conversion to web components
- Component library
  - [ ] a small one with the basics - should be able to copy a lot from react?
    - so many of them, https://bosonic.github.io/elements/dialogs-modals.html, cf. 
    materializecss, etc.
- Drivers library
  - analyze benefits of immutability for store drivers
- Demo
  - [ ] continue to complete demo from Angular2 book on github site
  - [ ] [Real world app?](https://github.com/gothinkster/realworld)
- Testing
    - [ ] Model-based testing for FSM, i.e. automatic test cases generation
    - [ ] study testing with pupeeteer.js (chrome headless browser)
- Combinators
    - [ ] [Portal](https://reactjs.org/docs/portals.html) combinator (render DOM in a specific location)
    - [ ] `Catch` combinator? cf. Core -- error management
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
    - [ ] State combinator `WithState`
    - [ ] Action combinator `ComputeActions`
- Distribution
  - [ ] monorepo?
  - [ ] individual combinator packages?

</details>


## Roadmap v0.4
Please note that library is still wildly under development :

- APIs ~~might~~ will go through breaking changes
- you might encounter problems in production
- performance has not been investigated as of yet

The current roadmap for the v0.4 stands as :

- Core
    - [x] component model
    - [x] DOM merge with slot assignment (a la web component)
    - [x] documentation for a-la-web-component slot mechanism
      - [non-technical](https://css-tricks.com/intro-to-vue-2-components-props-slots/), or 
     https://skyronic-Demo.com/blog/vue-slots-example 
    - [x] documentation combinators
    - [x] nice blog site : github pages?
      - [x] select static site generator (Jekyll, Hexo, Hugo)
      - [x] blog site architecture
      - [x] theoretical underpinnings
    - [x] implement sample application taken from Angular2 book
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


# Demos
## Example application
The example application is taken from the book [Mastering Angular2 components](https://www.packtpub.com/web-development/mastering-angular-2-components). Cf. [screenshot](https://brucou.github.io/posts/a-componentization-framework-for-cyclejs/#example) here.

- sits in `examples/AllInDemo` directory
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/AllInDemo` directory 

## State Machine
- go to `$HOMEDIR/examples/volunteerApplication`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/volunteerApplication` directory 

## Switch
- go to `$HOMEDIR/examples/SwitchLogin`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/SwitchLogin` directory

## OnRoute
- go to `$HOMEDIR/examples/NestedRoutingDemo`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/NestedRoutingDemo` directory

## ForEach and List
- go to `$HOMEDIR/examples/ForEachListDemo`
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/ForEachListDemo` directory

# Contribute
Contribution is **welcome** in the following areas :

- devops
  - monorepos
  - whatever makes sense to make the repository more manageable
- reducing build size

# Known issues
That is a paragraph that I am sure will grow with time :-)
