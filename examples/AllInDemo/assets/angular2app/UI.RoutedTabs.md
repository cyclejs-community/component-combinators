# RoutedTabs
RoutesTabs has `tabs` props with array of description and link. When click on link, route changes, and for that route a component is associated. In the given example, that gives : [
  m({}, {}, [
    TabHeader({tabs}),
    OnRoute({route : taskLink}, [ProjectTaskList]),
    OnRoute({route : commentLink}, [ProjectComments]),
    OnRoute({route : activitiesLink}, [ProjectActivities]),
  ])
]

