import { OnRoute, InjectSourcesAndSettings  } from "@rxcc/components"
import { format, DOM_SINK  } from "@rxcc/utils"
import * as Rx from "rx";
import { HomePage } from "./HomePage"
import { AspirationalPageHeader, Card, CardDetail } from "./AspirationalPage"
import {
  BLACBIRD_CARD_INFO, BLACK_BIRD_DETAIL_ROUTE, TECHX_CARD_DETAIL_ROUTE, TECHX_CARD_INFO,
  TYPOGRAPHICS_CARD_DETAIL_ROUTE, TYPOGRAPHICS_CARD_INFO
} from "./properties"

const $ = Rx.Observable;
const ROUTE_SOURCE = 'route$';

function injectRouteSource(sources) {
  const { router } = sources;

  const route$ = router
    .map(location => {
      const route = location.pathname;
      return (route && route[0] === '/') ? route.substring(1) : route
    });

  return {
    [ROUTE_SOURCE]: route$
      .tap(x => console.debug(`App > injectRouteSource > route$ emits :`, format(x)))
      .share()
  }
}

export const App = InjectSourcesAndSettings({
  sourceFactory: injectRouteSource,
  settings: {
    sinkNames: [DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE,
    trace: 'App'
  }
}, [
  OnRoute({ route: '', trace: 'OnRoute (/)' }, [
    HomePage
  ]),
  OnRoute({ route: 'aspirational', trace: 'OnRoute  (aspirational)' }, [
    InjectSourcesAndSettings({ settings: { breadcrumbs: ['aspirational'] } }, [
      AspirationalPageHeader, [
        Card(BLACBIRD_CARD_INFO),
        OnRoute({ route: BLACK_BIRD_DETAIL_ROUTE, trace: `OnRoute (${BLACK_BIRD_DETAIL_ROUTE})` }, [
          CardDetail(BLACBIRD_CARD_INFO)
        ]),
        Card(TECHX_CARD_INFO),
        OnRoute({ route: TECHX_CARD_DETAIL_ROUTE, trace: `OnRoute (${TECHX_CARD_DETAIL_ROUTE})` }, [
          CardDetail(TECHX_CARD_INFO)
        ]),
        Card(TYPOGRAPHICS_CARD_INFO),
        OnRoute({
          route: TYPOGRAPHICS_CARD_DETAIL_ROUTE,
          trace: `OnRoute (${TYPOGRAPHICS_CARD_DETAIL_ROUTE})`
        }, [
          CardDetail(TYPOGRAPHICS_CARD_INFO)
        ]),
      ]])
  ]),
]);

// TODO : home route / matching
// - what if I want to put there a coponent which is always displayed? How to do it with this
// formulat? Should I not switch to have '/' always matching instead of now not matching??
