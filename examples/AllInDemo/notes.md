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
    - `ev.preventDefault` SHOULD be in the event part, not the action part! We want  `makeAction` to be a pure function

HOW WOULD I DO A TABBED COMPONENT? ALSO STEP COMPONENT!
App = Tabs({tabs: [tab1, tab2, tab3]}, [Parent, [
  Tab1,
  Tab2,
  Tab3
]]
)

- tabs is an array of intents corresponding to the trigger to activate each tab
- Tabs will be implemented with a Switch component
- Parent ()and children) will receive in its settings the `when` (or `matched`?) property to hold the index of the tab to activate
- Parent can then render differently (header?) as a function of that

HOW TO DO A PROGRESS BAR COMPONENT
With ForEach
App = ForEach ({from, as}, [
  ProgressBar
])
- from is for instance the intent click on a +/- button
- as is the field necessary for ProgressBar 

HOW WOULD I DO AN ACCORDEON COMPONENT?
???
