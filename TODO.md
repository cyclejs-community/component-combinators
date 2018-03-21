# Combinators
- for next version, move towards a InjectSources only for sources, and settings injected through
Combine (object) or InjectSettings(function, use to adapt settings). Worse case, that adds a level
 in the tree, but more readable logic
- Use Pipe({},[WithEvents(...), WithState(...), ComputeActions(...)]) would be any leaf
      // component including generic or ad-hoc components.
      // InjectSources would be state visible in all the hierarchy, while WithState only visible
      // in Pipe - ComputeActions
      // Those three components actually are the same component sources -> settings, what changes
      // is meaning i.e. meta like log
- make combinator ForEachOfList as shortcut for ForEach(...ListOf(...))
- // TODO : a DIV combinator (instead of a Div component - or both??)

# Core
- // TODO : have versioned doc too...
// TODO : document that mergeSinks in this version can have null as parentSinks
// TODO : in the log analysis, be careful that path is duplicated (which is good) but messages also are
// so Foreach content -> Foreach|Inner same content but new id
// TODO : in the draw of graph, I can desambiguate in and out trace with the path
// ForEach graph structure several times will ahve the same lines..
// we know about recreation of branchs of the tree when a graph structure appears after a runtime portion, path
// gives the location of the branch
-   // TODO : document on blog the contracts functions...
    // NTH : review the specs for the error logging, it is still hard to read for instance for isRecordE
    // it shows args for the isRecordE not for the predicate failing
- create a function with same name, or update function name -> add a displayName property!
  - this should allow to remove the eval in the decorateWithAdvice function
- investigate https://github.com/twitter/hogan.js
  - writing view in mustache, and precompiling it
  - with partials, css should be able to be included meaning we can have a component file
- investigate microbundle instead of rollup : https://github.com/developit/microbundle
- have a sanbox dedicated playground?
- do sth about position updates for AllInDemo - deletion and insert; also what is nr?
  - nr is an unique id
  - cannot use position for index... would not work later with drag and drop
  - so rehave a look at the logic
- think about work around for isolation, components need to pass their click free of concerns
- m : write a better doc to explain settings inheritance, and put in the docs not in the code
  - write an interactive application with update of the three possible settings
- all components : replace singular treatment for DOM into behaviourSinkNames, sinkNames
  - all behaviourSinkNames must give a zero value (for DOM : $.of(null)
  - but really find a non-DOM example and investigate, it is not so simple
- NTH : Router : route params property name could be configured in settings, to think about
- NTH : Router : route params could be directly passed as settings to children components
- TODO : FSM : a bunch of them pending
- TODO : for all components, decide if I pass the settings of the combinator downstream!!
   - for instance, sinkNames is good to pass downstream, but slot would not be!!
- TODO : see how to translate that https://github.com/Shopify/draggable?
- TODO : what about animations? How does that play with vDom?

# Routing
cf. https://css-tricks.com/react-router-4/ and investigate if our router can do all these patterns :

- Nested Layouts
- Redirect
- Exclusive Routing
- Inclusive Routing
- Conditional routing (Authorized Route)
- Preventing transition

# Build/devop
- study parcel
- change @rxcc/testing to testutils
- change assertContract to use auto print arguments with %O, so I don't have to use format
- remove format and use console.log ?? will be complicated with assertCotnract in its current form
- also in FSM and else use console.context for logging
- size build
  - rx.all -> rx-lite
  - webpack with tree-shaking?
  - No, rather rollup but put every used modules in es6
    - cycle snabbdom, snabbdom-to-html the first ones
    - lodash remove, kebabCase etc. (cycle-snabbdom), takes LOT\S of space
    - fast-json-patch too to ES6 modules
    - pretty format and FSM are also big, but nothing to do about it, maybe separate FSM out?

# Release
- rewrite README.md
- put myself in position of first reader and explain/sell better
  - show JSX like syntax?
  - use Andre's abstraction (introduction to ractive programming) about rxjs
  - or wait to have one picture from a generated log

# Learn
- review git rules

# Documentation/Example
- blog : investigate highlighitn with ``` how to add new syntax, or what is the list```
- blog : add ⇡ character for back to top cf. view-source:https://sarabander.github.io/sicp/html/1_002e3.xhtml#pagetop
  - `<section><span class="top jump" title="Jump to top"><a href="#pagetop" accesskey="t">⇡</a></span><a id="pagetop"></a><a id="g_t1_002e3"></a>`
  - code https://sarabander.github.io/sicp/html/js/footnotes.js
  - and https://sarabander.github.io/sicp/html/js/footnotes.js
  - http://www.leancrew.com/all-this/2010/05/popup-footnotes/
  - http://www.leancrew.com/all-this/2010/05/a-small-popup-footnote-change/
- blog: add those shortcodes
  - https://learn.netlify.com/en/shortcodes/mermaid/
  - https://learn.netlify.com/en/shortcodes/children/ (looked for long how to do this...)
  - series : https://realjenius.com/2017/08/07/series-list-with-hugo/
  - https://github.com/parsiya/Hugo-Shortcodes
    - code caption (!)
    - Octopress blockquote
  - https://jpescador.com/blog/leverage-shortcodes-in-hugo/
    - image post
  - http://redhatgov.io/workshops/example/hugo_shortcodes/
    - figure shortcode (better than markdown original as it has caption)
- for new comers
// When trying to expand this example to a proper app, it quickly becomes an avalanche
// of unsolvable questions:
//
//   How do I keep track of all the streams?
//   Where do I keep state?
//   Where and how do I propagate my HTTP requests?
//   How do my child components communicate with parents and vice versa?
//   How do I deal with lists of things?
//   How do I communicate between components in different parts of the page?
//   How do I respond to and possibly propagate errors (anywhere: HTTP responses, form field
// values etc.)?
//   How do I do forms and form validation?
//   How do I...?
//   //

- angular app
// TODO:  1. draggable first
// TODO:  2. tags
// TODO:  3. scroll
// TODO : understand the plugin thing (used for task info)

- cf. react website https://reacttraining.com/react-router/web/guides/philosophy

# Testing
Well, testing is complicated by having impure functions, so not sure what to do here. Best is to
have nice tracing/debugging, and then test with instrumenting the gui (a la flaky selenium).

# TODO TODO
- ROLL UP AND RELEASE
- start working on logging and visualization -> architecture note
- start working on the new cycle event/state handling-> architecture draft article to write

# Quotes
- https://www.oreilly.com/ideas/reactive-programming-vs-reactive-systems
> We are no longer building programs—end-to-end logic to calculate something for a single operator—as much as we are building systems.
> In order to deliver systems that users—and businesses—can depend on, they have to be responsive, for it does not matter if something provides the correct response if the response is not available when it is needed. In order to achieve this, we need to make sure that responsiveness can be maintained under failure (resilience) and under load (elasticity). To make that happen, we make these systems message-driven, and we call them reactive systems.
