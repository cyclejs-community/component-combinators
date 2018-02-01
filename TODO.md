# Combinators
- Use Pipe({},[WithEvents(...), WithState(...), ComputeActions(...)]) would be any leaf
      // component including generic or ad-hoc components.
      // InjectSources would be state visible in all the hierarchy, while WithState only visible
      // in Pipe - ComputeActions
      // Those three components actually are the same component sources -> settings, what changes
      // is meaning i.e. meta like log
- make combinator ForEachOfList as shortcut for ForEach(...ListOf(...))
- // TODO : a DIV combinator (instead of a Div component - or both??)

# Core
- think about work around for isolation, components need to pass their click free of concerns
- m : write a better doc to explain settings inheritance, and put in the docs not in the code
  - write an interactive application with update of the three possible settings
- m : design better trace information
  - for instance outer trace could be concatenated to inner trace to trace also the component 
  hierarchy
- all components : replace singular treatment for DOM into behaviourSinkNames, sinkNames
  - all behaviourSinkNames must give a zero value (for DOM : $.of(null)
  - but really find a non-DOM example and investigate, it is not so simple
- NTH : Router : route params property name could be configured in settings, to think about
- NTH : Router : route params could be directly passed as settings to children components
- TODO : FSM : a bunch of them pending
- NOTE : run the router only with cycle history (done in AllIn demo)
- TODO : for all components, decide if I pass the settings of the combinator downstream!!
   - for instance, sinkNames is good to pass downstream, but slot would not be!!
- TODO : change InjectSourcesAndSettings so that factory returns both sources and settings so
 one function call factory(sources, settings) -> {sources : {sources hash}, settings: new
 settings}
- TODO : cleanup and break up utils, too many thigns there, look for cohesion
- TODO : add examples for :
   - authentication : take it from firebase sparks
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
- TODO : get all working with latest version of snabdomm, and cycle-run etc.
- InjectStateInSinks to remove
- size build
  - rx.all -> rx-lite
  - webpack with tree-shaking?
  - No, rather rollup but put every used modules in es6
    - cycle snabbdom, snabbdom-to-html the first ones
    - lodash remove, kebabCase etc. (I think it was json-patch? or where was it?)
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

In summary,

- So what?
  - readable, i.e. understandable, the logic is immediately apparent from the use of combinators
    - A projectTaskList is a list of tasks, and a task is ...
    - compare that with chldren(sources) with lots of $ in settings, and then sinks this merge 
    sinks that. The combination logic is abstracted into the combinator, that is what it is for.
  - supports iterative development through refinement
    - current approach does not, if you call children comp, you then have to merge the sinks, and
     you don't know yet what are the sinks for your child, if you don't know what you will put 
     there...
   - make explicit a syntax tree for a DSL, in which combinators are the keywords, and components
    are the variables, i.e. in the future the DSL could be extracted and code generated through 
    parsing
   - tracing and loggging should be easy and allow for visualization
     - next release!! 

# TODO TODO 
- ROLL UP AND RELEASE
- start working on logging and visualization -> architecture note
- start working on the new cycle event/state handling-> architecture draft article to write
- MAKE A RELEASE!!!!
  - rmove lodash dependency (forOwn, kebabCase, escape, etc.) that is snabbdom-to-html, which I 
  don't even use... except for debugging i.e. in dev
  - so add a DEV variable which will be taken out when building for prod or sth like that

- OR GO BACK TO MASTER and bundle with webpack - look at size in prod...
- try some default files from webpack the new one

- RELEASE a version!!
  - umd
- AND THEN I will have to redo the demos but importing the library with package.json and the 
release number
- RUN PRETTIER!!


Note that the present content will be easier to grasp for people with already some knowledge of 
streams/rxjs/cyclejs components. The documentation assumes that prior knowledge. I do not spend too 
much time explaining what `sources` is, and how rxjs streams can be combined (though I don't think any example has anything else than `map` 
and `filter`).

I will now be using this library in my future projects. I'll now also take a little break on the 
development of the first step (see roadmap on things to improve on) to focus on the second and 
third step (visualization -- thanks to this work, it should now be possible to visually and 
interactively trace and debug an application). In the meanwhile, I would be grateful to have 
feedback from the community. Any feedback is useful, but constructive feedback is even better, 
and helps identify pain points or prioritize features. 

# Sample app
- tic-tac-toe : showcases what?
  - https://ejdraper.com/2018/01/17/tic-tac-toe-with-vuejs/

# Quotes
- https://www.oreilly.com/ideas/reactive-programming-vs-reactive-systems
> We are no longer building programs—end-to-end logic to calculate something for a single operator—as much as we are building systems.
> In order to deliver systems that users—and businesses—can depend on, they have to be responsive, for it does not matter if something provides the correct response if the response is not available when it is needed. In order to achieve this, we need to make sure that responsiveness can be maintained under failure (resilience) and under load (elasticity). To make that happen, we make these systems message-driven, and we call them reactive systems.
