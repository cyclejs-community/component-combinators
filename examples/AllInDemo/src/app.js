import * as Rx from "rx";
import { ROUTE_SOURCE } from "./properties"
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../src/components/Inject/InjectSourcesAndSettings"
import { Div, DOM_SINK, format } from "../../../src/utils"
import { values } from 'ramda'
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
      user$: sources.domainQuery.getCurrent(USER),
      // NOTE : `values` to get the actual array because firebase wraps it around indices
      projects$: sources.domainQuery.getCurrent(PROJECTS).map(values)
    }
  },
  settings: {
    sinkNames: ['domainQuery', 'domainAction$', DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE
  }
}, [
  // NOTE :
  // 1. url$ is derived from `ROUTE_SOURCE`, hence must be injected after
  // 2. we need both the changed route EVENT and the current route BEHAVIOUR (url$)
  // Note that url$ is always the full route in the browser, i.e. no nested route here
  InjectSources({ url$: (sources, settings) => sources[ROUTE_SOURCE].shareReplay(1) }, [
    Div('.app'), UI
  ])
]);
