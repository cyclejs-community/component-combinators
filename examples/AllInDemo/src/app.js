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
import { SidePanel } from "./.SidePanel"
import { MainPanel } from "./.MainPanel"
import "app.scss"

const $ = Rx.Observable;

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
      // NOTE : domain driver always send behaviour observables (i.e. sharedReplayed already)
      user$ : sources.domainQuery.getCurrent(USER),
      // NOTE : `values` to get the actual array because firebase wraps it around indices
      projects$: sources.domainQuery.getCurrent(PROJECTS).map(values)
    }
  },
  settings: {
    sinkNames: ['domainQuery', 'domainAction$', DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE
  }
}, [Div('.app'), UI]);
