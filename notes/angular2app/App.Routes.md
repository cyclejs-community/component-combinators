## Routes
  new Route({path: 'dashboard', component: ProjectsDashboard}),
  new Route({path: 'projects/:projectId', component: Project}),
  new Route({path: 'plugins', component: ManagePlugins})
  // For /projects/:projectId
  new Route({ path: 'tasks', component: ProjectTaskList}),
  new Route({ path: 'task/:nr', component: ProjectTaskDetails}),
  new Route({ path: 'comments', component: ProjectComments}),
  new Route({ path: 'activities', component: ProjectActivities})

