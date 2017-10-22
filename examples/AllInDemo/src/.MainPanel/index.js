import * as Rx from "rx";
import { OnRoute } from "../../../../src/components/Router/Router"
import { Div } from "../../../../src/utils"
import { m } from "../../../../src/components/m/m"
import { Project } from './..Project'
import { ProjectsDashboard } from './..ProjectsDashboard'
import { ManagePlugins } from './..ManagePlugins'
// TODO : DOC : NOTE : that is a coupling between child and parent, the scroll bar of task list
// is actually at main panel level... This appears because we don't want to compute at run-time
// the element to put the scroll event handler on. Cycle Dom source works only with selectors,
// not element!  TODO find a nicer solution : write my own dom source??
import { TaskListScrollBarSelector } from './..Project/...ProjectTaskList/properties'

export const MainPanel =
  m({}, {}, [Div(`${TaskListScrollBarSelector}.app__l-main`), [
    OnRoute({ route: 'dashboard' }, [ProjectsDashboard]),
    OnRoute({ route: 'projects/:projectId' }, [Project]),
    OnRoute({ route: 'plugins' }, [ManagePlugins]),
  ]]);

// TODO : issue with side panel, I don't see the route params, onRoute('') will not match
// always, when it actually should... well confirm it first
