// TODO : all : think about work around for isolation, components need to pass their click free of
// concerns
// TODO : m : write a better doc to explain settings inheritance, and put in the docs not in te code
// TODO : m : design better trace information
// for instance outer trace could be concatenated to inner trace to trace also the
// component hierarchy
// TODO : all components : replace singular treatment for DOM into behaviourSinkNames, sinkNames
// - all behaviourSinkNames must give a zero value (for DOM : $.of(null)
// - but really find a non-DOM example and investigate, it is not so simple
// NTH : Router : route params property name could be configured in settings, to think about
// NTH : Router : route params could be directly passed as settings to children components
// TODO : FSM : a bunch of them pending
// TODO : also review the structure of the repository (m_helpers? history_driver? where to put
// runTestScenario?)
// TODO : move to rollup? why lib/rxcc.min.js is so big ? because rx?
// NOTE : run the router only with cycle history (done in AllIn demo)
// TODO : get all working with latest version of snabdomm, and cycle-run etc.
// TODO : tabbed component? + demo?
// TODO : remove most runTestScenario, see how to publish it separately (...monorepo...)
// TODO : for all components, decide if I pass the settings of the combinator downstream!!
// - for instance, sinkNames is good to pass downstream, but slot would not be
// TODO : change InjectSourcesAndSettings so that factory returns both sources and settings so
// one function call factory(sources, settings) -> {sources : {sources hash}, settings: new
// settings}
// TODO : cleanup utils, too many thignsthere, look for cohesion
// TODO : InSlot combinator which takes a component and adds a given slot to its vdom sink
// - InSlot({slot : ''navigation-section'}, [NavigationSection()],
