import { Div } from "@rxcc/utils"
import { m, OnRoute } from "@rxcc/components"
import { Project } from './..Project'
import { ProjectsDashboard } from './..ProjectsDashboard'
import { ManagePlugins } from './..ManagePlugins'
import { TaskListScrollBarSelector } from './..Project/...ProjectTaskList/properties'

export const MainPanel =
  m({}, {}, [Div(`${TaskListScrollBarSelector}.app__l-main`), [
    OnRoute({ route: 'dashboard' }, [ProjectsDashboard]),
    OnRoute({ route: 'projects/:projectId' }, [Project]),
    OnRoute({ route: 'plugins' }, [ManagePlugins]),
  ]]);
