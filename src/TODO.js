// TODO : all : think about work around for isolation, components need to pass their click free of
// concerns
// TODO : m : write a better doc to explain settings inheritance, and put in the docs not in te code
// TODO : m : design better trace information
// for instance outer trace could be concatenated to inner trace to trace also the
// component hierarchy
// TODO : m : also add slot mechanism to default DOM merge to include child component at given
// position of parent : PUT THE SLOT IN VNODE DATA property
//       necessary to add a `currentPath` parameter somewhere which
//       carries the current path down the tree
// TODO : all components : replace singular treatment for DOM into behaviourSinkNames, sinkNames
// - all behaviourSinkNames must give a zero value (for DOM : $.of(null)
// - but really find a non-DOM example and investigate, it is not so simple
// NTH : Router : route params property name could be configured in settings, to think about
// TODO : FSM : a bunch of them pending
// TODO : also review the structure of the repository (m_helpers? history_driver? where to put
// runTestScenario?)
