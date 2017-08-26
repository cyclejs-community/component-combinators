import { OnRoute } from "../../../src/components/Router/Router"
import { m } from "../../../src/components/m"
import { DOM_SINK, format } from "../../../src/utils"
import * as Rx from "rx";
import { HomePage } from "./HomePage"
import { ROUTE_SOURCE } from "../../../src/components/Router/properties"
import { AspirationalPageHeader, Card, CardDetail } from "./AspirationalPage"
import {
  BLACBIRD_CARD_INFO, BLACK_BIRD_DETAIL_ROUTE, TECHX_CARD_DETAIL_ROUTE, TECHX_CARD_INFO,
  TYPOGRAPHICS_CARD_DETAIL_ROUTE, TYPOGRAPHICS_CARD_INFO
} from "./properties"

const $ = Rx.Observable;

function injectRouteSource(sources) {
  const route$ = sources.router.observable.pluck('pathname').map(route => {
      return (route && route[0] === '/') ? route.substring(1) : route
    }
  )

  return {
    [ROUTE_SOURCE]: route$
      .tap(x => console.debug(`App > injectRouteSource > route$ emits :`, format(x)))
        .share()
  }
}

function InjectSourcesAndSettings({ sourceFactory, settings }, childrenComponents) {
  return m({ makeLocalSources: sourceFactory }, settings, childrenComponents)
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
    m({ makeOwnSinks: AspirationalPageHeader }, { breadcrumbs: ['aspirational'] }, [
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
        route: TYPOGRAPHICS_CARD_DETAIL_ROUTE, trace: `OnRoute (${TYPOGRAPHICS_CARD_DETAIL_ROUTE})`
      }, [
        CardDetail(TYPOGRAPHICS_CARD_INFO)
      ]),
    ])
  ]),
]);

// TODO : home route / matching
// - what if I want to put there a coponent which is always displayed? How to do it with this
// formulat? Should I not switch to have '/' always matching instead of now not matching??
// TODO : Switch - put in DOC
// with a function eq who let everything pass, and using the match property in the children, one can
// have a parameterized component which updates for every change in the parameter! Give an example!
// also explain advantage of this method : no need to use a source stream, simpler to write the
// component function then, separation of concerns, - : some peformance loss maybe?
// TODO : Switch btw have the switch component pass not only the when to the children but the
// incomoing value too!! And add the corresponding test...
// TODO : add InjectSourcesAndSettings as a component too
// TODO : change makeOwnSinks to ParentComponent somehow, probably [parent, [children]] is best API
// or [children] when there is no parent
// That way m only has the reducing functions, and can be curry in its first parameter
