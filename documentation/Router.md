

# Motivation
The `Router` component allows to associate a set of URL locations (routes) from a source (called location source) to a component or set of components. When the location source emits a route, the component(s) associated to that route should be activated and be parameterized by the information encoded in the route. 

Routing involves a sophisticated form of control flow, and relates strongly to the `Switch` component. However, there are specifics to the routing logic, due to the fact that routing in web applications is principally aimed at representing efficiently, concisely, and visually a specific state of the application :

- routing may be nested : a parent-child relationship at component level may be encoded with a parent-child relationship at route level 
	- the standard mapping is a relationship between sections of the url. For instance `URL : 'x/y/z'` mapped to `Components : A1(x,y) -- B1(z)`
- If a location source emits twice in sequence the same location, then there should be no update in the application state (i.e. no components activated, or deactivated, or updated)
- If a location source emits twice in sequence the same already mapped segment of url, then the associated component should not be updated. 
	- In the previous case, this means `URL : 'x/y/a'` should not lead to any change in the state of component `A1` while it might lead to the component `B1(z)` being replaced by the component `B2(a)`
	- visual representation of state is achieved by incorporating in route sections meaningful words from the application domain (`URL : show/items?all`)
	- A route may also encode parameter passing in its sections (`URL : add/book?author=John&title=Ahoj`) in a standard way to facilitate parsing by the matching component.

As one can see, routing, at a simplified level, can be modelized as a two-concerns entity :

1. a mapping between a URL (representing the application state) and a tree of components (which compose the application in the given state). In the case of nested routing, we have _in fine_ a mapping between a tree of URL sections and a tree of components.  This is generally referred to as _deep linking_.
2. a procedure to match updates of that URL to updates of the component tree as efficiently as possible.

Some applications add extra control-flow requirement to routing by adding another concern :

- accepting/rejecting transition from one route (application state) to another route

The current routing component targets concerns 1 and 2, while leaving the third concern to the rest of the application. While a hierarchical state machine in principle addresses nicely all three concerns (at least for a low number of control states), we went for a simpler implementation in this first draft, which should fully address the most common nested routing cases.

# API

## OnRoute :: RouteSettings -> [Component] -> RouteComponent

### Description
Creates a router component whose behaviour is parameterized via `RouteSettings`. Children components are the components to be mapped to the incoming route specified in settings.

The parametrization is as follows :

- an array of sink names must be passed to indicate which sinks are to be extracted from the children components. Sinks produced by any child component which are not in the sink names array will be ignored. It is not necessary, for any sink name in that array, for a child component to return a sink of that name.
- the route matching/parameter parsing is specified by a [syntax](https://github.com/cowboy/javascript-route-matcher) akin to a regular expression (termed instead a dynamic expression) :
```javascript
var search = routeMatcher("search/:query/p:page");
search.parse("search/gonna-fail") // null (no match)
search.parse("search/cowboy/p5")  // {query: "cowboy", page: "5"}
search.parse("search/gnarf/p10")  // {query: "gnarf", page: "10"}
```

The behaviour is as follows :

- for every incoming value of the location source, the incoming route is matched against the configured route
- if there is a match, and that match is the same as the previous match, nothing happens, the component(s) was/were already activated previously
- if there is a non-redundant positive match on the configured route, then 
	- the associated components are executed with 
		- a location source which is updated to remove the matched path from the current location source
			- this is the key mechanism allowing nested routing
		- a `matched` property in settings which contain the partial route matching (for instance `/section/:capture` will lead to `{matched: capture: '...'}`)
	- the sinks returned by the associated components are activated (merged into the rest of the application sinks)
		- those sinks whose name is not in the `sinkNames` property are discarded
		- those sinks whose name is in the `sinkNames` property are merged according to settings (default-merged if not)
- if there is not a positive match on the configured route, then 
  - `null` is emitted on `DOM` sinks. This is so under the hypothesis that router's parent DOM sink will merge its children sinks with `combineLatest`, so we need all DOM sinks to have an initial value to avoid blocking the `combineLatest` operation. We also need to pass on the fact that the DOM is actually empty on that route[^1], so that previously displayed DOMs are actually erased on route changes. Concretely there are two common cases :
	  - transition [MATCH, INIT] TO NO_MATCH -> EMITS NULL
	  - transition [MATCH, NO_MATCH] -> MATCH -> ALWAYS STARTS WITH NULL

One can refer to the tests to see this in action.

[^1]: The core reason is that DOM sink correspond to a behaviour, and hence should always have a value. That not being enforced by cyclejs framework forces us to adjust manually.

### Types
- `RouteComponent :: Component`
- `RouteSettings :: Record {`
- `  sinkNames :: [String]`  **Mandatory**
- `  route :: RouteSpec` **Mandatory**
- `}`
- `RouteSpec :: String` [syntax](https://github.com/cowboy/javascript-route-matcher)

### Contracts
- be careful about end slashing
- `route :: RouteSpec` should not end by a `/` or start with a `/` (**NOTE** : for now! this is due to how `routeRemainder` is parsed and passed to children...)

# Example

# Roadmap
- route parsing
	- have the parsing library as a configurable dependency
	- switch to more recent and functional https://github.com/rcs/route-parser

# Tips
- The null emission mechanism is explained here for reference, and for analyzing output when testing. In a real application, the only impact this should have is that the DOM sink can receive null inputs, and as such must guards against them (filtering them out for instance)
- The current parsing library does not parse query strings but passes all the query string to the component. One can then use a specific query string parsing library.  This ensures maximal flexibility for the router component library as any extra parsing library can be plugged in according to the shape of the route.

