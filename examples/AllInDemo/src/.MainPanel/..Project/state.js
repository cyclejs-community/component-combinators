import * as Rx from "rx";
import { OnRoute} from "../../../../../src/components/Router/Router"
import { ForEach } from "../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, format, Div, Nav, vLift,firebaseListToArray, preventDefault } from "../../../../../src/utils"
import { pipe, keys, values, always, filter, map, prop } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button } from "cycle-snabbdom"
import { m } from "../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../src/components/Router/properties"
import {ProjectTaskList} from "./...ProjectTaskList"
import {ProjectTaskDetails} from "./...ProjectTaskDetails"
import {ProjectComments} from "./...ProjectComments"
import {ProjectActivities} from "./...ProjectActivities"
import { ROUTE_SOURCE } from "../../../src/properties"

const $ = Rx.Observable;

export function projectsStateFactory(sources, settings){
  const { [ROUTE_PARAMS]: { projectId } } = settings;

  return sources.projectsFb$
      .map(projectsFb => {
        const fbKeys = keys(projectsFb);
        const _values = values(projectsFb);
        const index = _values.findIndex(project => project._id === projectId);
        const fbIndex = fbKeys[index];
        const project = _values[index];

        return {
          fbIndex,
          project
        }
      })
    .distinctUntilChanged(prop('fbIndex'))
    .shareReplay(1)
}
