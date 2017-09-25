import * as Rx from "rx";
import { OnRoute} from "../../../../../src/components/Router/Router"
import { ForEach } from "../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, format, Div, Nav, vLift,firebaseListToArray, preventDefault } from "../../../../../src/utils"
import { pipe, values, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li } from "cycle-snabbdom"
import { m } from "../../../../../src/components/m/m"
import 'user-area.scss'
import { ROUTE_PARAMS } from "../../../../../src/components/Router/properties"

const $ = Rx.Observable;

export const Project = function Project(sources, settings) {
  const {[ROUTE_PARAMS] : {projectId}} = settings;

  return {
    [DOM_SINK] : $.of(
      div(`TODO project id : ${projectId}`)
    )
  }
}

const tabItems = [
  {title: 'Tasks', link: ['tasks']},
  {title: 'Comments', link: ['comments']},
  {title: 'Activities', link: ['activities']}
];

m({},{}, [
  ProjectHeader,
  Tabs({tabItems}, [

  ])
]);
