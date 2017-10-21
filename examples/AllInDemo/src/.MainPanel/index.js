import * as Rx from "rx";
import { OnRoute} from "../../../../src/components/Router/Router"
import { ForEach } from "../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, format, Div, Nav, vLift,firebaseListToArray, preventDefault, DummyComponent } from "../../../../src/utils"
import { pipe, values, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li } from "cycle-snabbdom"
import { m } from "../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../src/components/Router/properties"
import {Project} from './..Project'
import {ProjectsDashboard} from './..ProjectsDashboard'
import {ManagePlugins} from './..ManagePlugins'
// TODO : DOC : NOTE : that is a coupling between child and parent, the scroll bar of task list
// is actually at main panel level... This appears because we don't want to compute at run-time
// the element to put the scroll event handler on. Cycle Dom source works only with selectors,
// not element!  TODO find a nicer solution : write my own dom source??
import {TaskListScrollBarSelector} from './..Project/...ProjectTaskList/properties'

const $ = Rx.Observable;

export const MainPanel = m({}, {}, [Div(`${TaskListScrollBarSelector}.app__l-main`), [
  OnRoute({route : 'dashboard'}, [
    ProjectsDashboard
  ]),
  OnRoute({route : 'projects/:projectId'}, [
    Project
  ]),
  OnRoute({route : 'plugins'}, [
    ManagePlugins
  ]),
]]);

// TODO : issue with side panel, I don't see the route params, onRoute('') will not match
// always, when it actually should... well confirm it first
