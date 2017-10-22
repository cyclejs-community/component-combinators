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

# What is best API?
- exposing m
- simple semantic wrapper around m
- ad-hoc combinator : more readable, but more work to write

export const SidePanel =
  m({}, {}, [Div('.app__l-side'), [
    m({}, {}, [Navigation, [
      // NOTE : this is the same as having NavigatinoSection({title}, componentTree)
      // except that we do not have to define that AD-HOC combinator
      // I'd rather have for now only the GENERAL combinator as combinators
      // TODO : but maybe that's the way to go??
      m({}, { title: 'Main' }, [NavigationSection, [
        m({}, { project: { title: 'Dashboard', link: 'dashboard' } }, [NavigationItem])
      ]]),
      m({}, { title: 'Projects' }, [NavigationSection, [
        InSlot('navigation-item', [
          InjectSources({ projectNavigationItems$: getProjectNavigationItems$ }, [
            ForEach({ from: 'projectNavigationItems$', as: 'projectList' }, [
              ListOf({ list: 'projectList', as: 'project' }, [
                EmptyComponent,
                NavigationItem
              ])
            ])
          ])
        ])
      ]]),
      m({}, { title: 'Admin' }, [NavigationSection, [
        m({}, { project: { title: 'Manage Plugins', link: 'plugins' } }, [NavigationItem])
      ]]),
    ]])
  ]]);


// not including the header
Navigation({}, [NavigationHeader, [
  NavigationSection({ title: 'Main' }, [NavigationSectionHeader, [
    NavigationItem( { project: { title: 'Dashboard', link: 'dashboard' } }, [])
  ]]),
  NavigationSection({ title: 'Projects' }, [NavigationSectionHeader, [
    // NOTE : necessary because `InjectSources` does not allow to set the slot by way of settings
    InSlot('navigation-item', [
      InjectSources({ projectNavigationItems$: getProjectNavigationItems$ }, [
        ForEach({ from: 'projectNavigationItems$', as: 'projectList' }, [
          ListOf({ list: 'projectList', as: 'project' }, [
            EmptyComponent,
            NavigationItem
          ])
        ])
      ])
    ])
  ]]),
  NavigationSection({ title: 'Admin' }, [NavigationSectionHeader, [
    NavigationItem( { project: { title: 'Manage Plugins', link: 'plugins' } }, [])
  ]]),
]])

// BETTER!!! no duplication of Headers, more readable too, though more work to write...
// including the header in the combinator definition
Navigation({}, [
  NavigationSection({ title: 'Main' }, [
    NavigationItem( { project: { title: 'Dashboard', link: 'dashboard' } }, [])
  ]),
  NavigationSection({ title: 'Projects' }, [
    InSlot('navigation-item', [
      InjectSources({ projectNavigationItems$: getProjectNavigationItems$ }, [
        ForEach({ from: 'projectNavigationItems$', as: 'projectList' }, [
          ListOf({ list: 'projectList', as: 'project' }, [
            EmptyComponent,
            NavigationItem
          ])
        ])
      ])
    ])
  ]),
  NavigationSection({ title: 'Admin' }, [
    NavigationItem( { project: { title: 'Manage Plugins', link: 'plugins' } }, [])
  ]),
])
