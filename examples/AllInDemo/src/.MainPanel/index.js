import { OnRoute } from "../../../../src/components/Router/Router"
import { Div } from "../../../../utils/helpers/src/index"
import { m } from "../../../../src/components/m/m"
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

// TODO : issue with side panel, I don't see the route params, onRoute('') will not match
// always, when it actually should... well confirm it first
