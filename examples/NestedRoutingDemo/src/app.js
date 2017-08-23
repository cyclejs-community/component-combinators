import { OnRoute } from "../../../src/components/Router/Router"
import { m } from "../../../src/components/m"
import { DOM_SINK } from "../../../src/utils"
import * as Rx from "rx";
import { HomePage } from "./HomePage"
import { ROUTE_SOURCE } from "../../../src/components/Router/properties"

const $ = Rx.Observable;

function injectRouteSource(sources) {
  const route$ = sources.router.observable.pluck('pathname').map(route => {
      return (route && route[0] === '/') ? route.substring(1) : route
    }
  )

  return {
    [ROUTE_SOURCE]: route$
  }
}

function InjectSourcesAndSettings({ sourceFactory, settings }, childrenComponents) {
  return m({ makeLocalSources: sourceFactory }, settings, childrenComponents)
}

export const App = InjectSourcesAndSettings({
  sourceFactory: injectRouteSource,
  settings: {
    sinkNames: [DOM_SINK, 'router'],
    routeSource : ROUTE_SOURCE,
    trace: 'App'
  }
}, [
  OnRoute({ route: '', trace: 'OnRoute (/)' }, [
    HomePage
  ]),
  /*
    OnRoute({ route: 'aspirational', trace: 'OnRoute  (aspirational)' }, [
      m({ makeOwnSinks: AspirationalPageHeader }, { breadcrumbs: ['aspirational'] }, [
        Card(BLACBIRD_CARD_INFO),
        OnRoute({route: BLACK_BIRD_DETAIL_ROUTE},[
          CardDetail(BLACBIRD_CARD_DETAILS)
        ]),
        Card(TECHX_CARD_INFO),
        OnRoute({route: TECHX_CARD_DETAIL_ROUTE},[
          CardDetail(TECHX_CARD_DETAILS)
        ]),
        Card(TYPOGRAPHICS_CARD_INFO),
        OnRoute({route: TYPOGRAPHICS_CARD_DETAIL_ROUTE},[
          CardDetail(TYPOGRAPHICS_CARD_DETAILS)
        ]),
      ])
    ]),
  */
]);

/*
AspirationalPageHeader
  contains
<div id="instafeed" class="ui one column doubling grid container one card">
  <div class="ui left breadcrumb">
  <a class="section">Home</a>
  <i class="right chevron icon divider"></i>
  <div class="active section">Aspirational</div>
  </div>
*/

