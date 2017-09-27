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

const $ = Rx.Observable;

export const MainPanel = m({}, {}, [Div('.app__l-main'), [
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
