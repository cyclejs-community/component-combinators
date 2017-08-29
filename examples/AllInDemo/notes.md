# Specifications

const sinkNames: ['auth$', DOM_SINK, 'router'];

App = InjectSourcesAndSettings({router, sinkNames, factory, trace...}, [
  OnRoute({route : 'main', trace : '...' }, [
    Switch({
      on: convertAuthToIsLoggedIn,
      trace: 'Switch'
    }, [
      Case({ when: IS_NOT_LOGGED_IN, trace: 'LoginPage Case' }, [
        LoginPage({ redirect: '/main' })
      ]),
      Case({ when: IS_LOGGED_IN, trace: 'MainPage Case' }, [
        MainPage
      ]),
    ])  
  ])
])

// A - Case each child generates its actions (sinks)
MainPage = InjectSourcesAndSettings({fetchedCardsInfo$ : fetch cards}, [
  ForEach({from : 'fetchedCardsInfo$', as : 'items'}, [
    AspirationalPageHeader, [
      ListOf({list : 'items', elementAs : 'cardInfo'}, [
        Card, 
      ])
    ]
  ])
])

Case A:
Card = function (sources, settings) {
  const {cardInfo, listOfIndex} = settings;
  const {projectKey, opportunityKey} = cardInfo;
  const clickableElementSelector = computeIt(listOfIndex, SOME_SELECTOR_PROP);
  
  const clickIntent$ = sources[DOM_SINK]
    .select(clickableElementSelector).event('click').do(preventDefault)
  const clickAction$ = clickIntent$.map(_ => someRoute(projectKey, opportunityKey))
  
  return {
    DOM : renderCard(clickableElementSelector, cardInfo),
    router : clickAction$
  }
}

// B - Case the parent merges the children sinks
MainPage = InjectSourcesAndSettings({fetchedCardsInfo$ : fetch cards}, [
  ForEach({from : 'fetchedCardsInfo$', as : 'items'}, [
    ListOf({list : 'items', as : 'cardInfo', buildActionsFromChildrenSinks:..., actionMap:{'clickIntent$':'router'}}, [
      AspirationalPageHeader, [
        Card, 
      ]
    ])
  ])
])

Case B:
Card = function (sources, settings){
  const {cardInfo, listOfIndex} = settings;
  const clickableElementSelector = computeIt(listOfIndex, SOME_SELECTOR_PROP);
  
  const clickIntent$ = sources[DOM_SINK]
    .select(clickableElementSelector).event('click').do(preventDefault)
  
  return {
    DOM : renderCard(clickableElementSelector, cardInfo),
    clickIntent$ : clickIntent$
  }
}
buildActionsFromChildrenSinks = {
  clickIntent$ : function merge(parentSink, childrenSinks, settings){
    // in B case, settings has as items the array from `items$` source
    const {items} = settings;
    
    return $.merge(childrenSinks.map((clickIntent$, index)=> {
      const cardInfo = items[index];
      const {projectKey, opportunityKey} = cardInfo;

      return clickIntent$.map(_ => someRoute(projectKey, opportunityKey))
    }))
    // TODO: that returns a clickIntent$ source... so got to get the mergeSinks as a fn or write custom merge, but pass a mapping in ListOf, to map childrenSinks to merged final parent sink I AM HERE

  }
}

// TODO : should I do a rename sink operator?? maybe

NOTE:
// Card : items will be passed in settings, with the same name as in ListOf, no that creates a dependency in the wrong direction, so Card decides its setting prop, and ListOf adapts to it, so we assume here it is items$ decided by card DOC it

fetch cards information
display it
the links too I need - I want a click I dont' want to route, for testing the componentl ibrary
so 
1. each card may generate its own link, and sinks in general
  a. the parent sink (so I need one) takes children sinks, associate an index on exit, then a merge function should always be the same {sinkName : merge()
2. each card generate an id or sth with the index
  a. the parent creates the listener at his level and compute the merged sinks (like in delegation)

HOW IT WORKS:
- breakdown the component tree with control flow combinators and 'sequential' or 'linear' operators
  - control flow
    - Switch, ForEach, FSM, Router
  - linear
    - `Events :: HashMap<EventName, EventSource>`
    - `EventsFactory :: HashMap<EventName, EventFactory>`
    - `EventFactory :: Sources -> Settings -> EventSource`
    - `Event :: Observable`
    - `MakeActionsSettings :: Record{makeAction :: ActionsFactory}`
    - `ActionsFactory :: Events -> Actions`
    - `Actions :: HashMap<SinkName, Sink>`
    - MakeEvents :: EventsFactory -> [Component] -> Component
      - Note that it might be useful to have also 
        - `EventsFactory :: Sources -> Settings -> Events` in case we need to make events from other previously made events (! be careful with the share and replay semantics there!!)
    - `MakeActions :: MakeActionsSettings -> [Component] -> Component` 
      - `makeAction` is a pure function
    - we skip the intent intermediary step (often mapping one to one to action)
    - `ev.preventDefault` SHOULD be in the event part, not the action part! We want  `makeAction` to be a pure function
      
