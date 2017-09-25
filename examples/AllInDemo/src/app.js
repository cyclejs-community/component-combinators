import * as Rx from "rx";
import { ROUTE_SOURCE } from "./properties"
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div } from "../../../src/utils"
import { pipe, values } from 'ramda'
import { PROJECTS, USER } from "./domain/index"
import { p, div, img, nav, strong } from "cycle-snabbdom"
import { m } from "../../../src/components/m/m"
import 'user-area.scss'
import { SidePanel } from "./.SidePanel"

const $ = Rx.Observable;

const MainPanel = DummyComponent;

const UI = [SidePanel, MainPanel];

export const App = InjectSourcesAndSettings({
  sourceFactory: function (sources, settings) {
    return {
      // router
      [ROUTE_SOURCE]: sources.router
        .map(location => {
          const route = location.pathname;
          return (route && route[0] === '/') ? route.substring(1) : route
        })
        .tap(
          x => console.debug(`App > InjectSourcesAndSettings > ${ROUTE_SOURCE} emits :`, format(x))
        )
        // starts with home route
        .startWith('')
        .share(),
      user$ : sources.domainQuery.getCurrent(USER),
      projects$: sources.domainQuery.getCurrent(PROJECTS)
    }
  },
  settings: {
    sinkNames: ['domainQuery', 'domainAction$', DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE
  }
}, [Div('.app'), UI]);
