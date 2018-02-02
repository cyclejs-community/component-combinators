import { ROUTE_SOURCE } from "./properties"
import { InjectSourcesAndSettings } from "@rxcc/components"
import { Div, DOM_SINK } from "../../../utils/helpers/src/index"
import { values } from 'ramda'
import { PROJECTS, USER } from "./domain"
import { SidePanel } from "./.SidePanel"
import { MainPanel } from "./.MainPanel"

export const App = InjectSourcesAndSettings({
    sourceFactory: function (sources, settings) {
      // NOTE : we need the current route which is a behaviour
      const { router, domainQuery } = sources;
      const currentRouteBehaviour = router
        .map(location => {
          const route = location.pathname;
          return (route && route[0] === '/') ? route.substring(1) : route
        })
        .tap(
          x => console.debug(`App > InjectSourcesAndSettings > ${ROUTE_SOURCE} emits : %O`, x)
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
      const incomingRouteEvents$ = currentRouteBehaviour.share();
      const projects$ = domainQuery.getCurrent(PROJECTS);
      const user$ = domainQuery.getCurrent(USER);

      return {
        // router
        url$: currentRouteBehaviour,
        [ROUTE_SOURCE]: incomingRouteEvents$,
        // NOTE : domain driver always send behaviour observables (i.e. sharedReplayed already)
        user$,
        // NOTE : `values` to get the actual array because firebase wraps it around indices
        projects$: projects$.map(values),
        projectsFb$: projects$
      }
    },
    settings: {
      sinkNames: ['domainAction$', 'storeUpdate$', DOM_SINK, 'router', 'focus'],
      routeSource: ROUTE_SOURCE
    }
  }, [Div('.app'), [
    SidePanel,
    MainPanel
  ]]
);
