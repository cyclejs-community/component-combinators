import * as Rx from "rx";
import { ROUTE_SOURCE } from "./properties"
import { InjectSourcesAndSettings } from "../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, DummyComponent, format } from "../../../src/utils"

const $ = Rx.Observable;

const MainPanel = DummyComponent;
const SidePanel = DummyComponent;

const UI = [MainPanel, SidePanel];

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
        .share()
    }
  },
  settings: {
    sinkNames: ['domainQuery', 'domainAction$', DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE
  }
}, UI);

