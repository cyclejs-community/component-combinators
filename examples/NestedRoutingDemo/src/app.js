import { OnRoute } from "../../../src/components/Router/Router"
import { DOM_SINK } from "../../../src/utils"
import * as Rx from "rx";
import { HomePage } from "./HomePage"

const $ = Rx.Observable;

// TODO : I am here, thats the code for swtich demo, adaprt to router demo

export const App = m({}, { sinkNames: [DOM_SINK, 'router'], trace: 'App' }, [
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

