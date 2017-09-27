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
    // NOTE : we need the current route which is a behaviour
    const currentRouteBehaviour = sources.router
      .map(location => {
        const route = location.pathname;
        return (route && route[0] === '/') ? route.substring(1) : route
      })
      .tap(
        x => console.debug(`App > InjectSourcesAndSettings > ${ROUTE_SOURCE} emits :`, format(x))
      )
      // starts with home route
      .startWith('')
      .shareReplay(1);
    // NOTE : we need the route change event
    // Now it was important to do this in that order, because we want currentRouteBehaviour to
    // be subscribed before (no route change before having a current route)
    // A former implementation url$ = incomingRouteEvents$.shareReplay(1) failed as url$ was not
    // subscribed till after the route had changed, and by then the new route value was already
    // emitted, so url$ would not emit anything... One has to be very careful dealing with
    // streams and ordering
    const incomingRouteEvents$ = currentRouteBehaviour
        .share();

    return {
      // router
      url$ : currentRouteBehaviour,
      [ROUTE_SOURCE]: incomingRouteEvents$,
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
},  [    Div('.app'), UI  ]
);
