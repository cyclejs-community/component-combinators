import {
  DOM_SINK,
} from "../../utils/src/index"
import { m } from "./m"
import { combinatorNameInSettings } from "../../tracing/src/helpers"
import {set} from 'ramda'

// NOTE ADR: we use `m` here, we have to, to benefit from the tracing functionality that m offers.
export function InSlot(slotName, [component]) {
  // TODO : add a contract checking array of one component
  return function InSlot(sources, settings) {
    const sinks = m({}, set(combinatorNameInSettings, 'InSlot', {}), [component])(sources, settings);
    const vNodes$ = sinks[DOM_SINK];

    sinks[DOM_SINK] = vNodes$.do(vNode => {
      // NOTE : guard necessary as vNode could be null : OnRoute combinator for instance sends null
      // Those null are filtered at top level (filterNull), so we let them propagate to the top
      if (vNode) vNode.data.slot = slotName;
    });

    return sinks
  }
}
