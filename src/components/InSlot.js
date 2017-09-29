import * as Rx from "rx";
import { InjectSources } from "./Inject/InjectSources"
import { InjectSourcesAndSettings } from "./Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift } from "../utils"
import { pipe, values, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button } from "cycle-snabbdom"
import { m } from "./m/m"

// TODO : use m and a merge function
export function InSlot(slotName, [component]){
  return function InSlot(sources, settings){
    const sinks = component(sources, settings);
    const vNodes$ = sinks[DOM_SINK];

    sinks[DOM_SINK] = vNodes$.do(vNode => {
      vNode.data.slot = slotName;
    });

    return sinks
  }
}
