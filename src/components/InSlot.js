import {
  DOM_SINK,
} from "../../utils/src/index"

// NOTE ADR: we don't use `m` here, we could but choose not to. As `m` will be use for logging, we
// have no interest in having a log for `InSlot` operations.
export function InSlot(slotName, [component]) {
  return function InSlot(sources, settings) {
    const sinks = component(sources, settings);
    const vNodes$ = sinks[DOM_SINK];

    sinks[DOM_SINK] = vNodes$.do(vNode => {
      // NOTE : guard necessary as vNode could be null : OnRoute combinator for instance sends null
      // Those null are filtered at top level (filterNull), so we let them propagate to the top
      if (vNode) vNode.data.slot = slotName;
    });

    return sinks
  }
}
