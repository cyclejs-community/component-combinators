import { DOM_SINK } from "../../../utils/helpers/src/index"
import * as Rx from "rx";
import { a, div, i } from 'cycle-snabbdom'

const $ = Rx.Observable;

export function AspirationalPageHeader(sources, settings) {
  const { breadcrumbs } = settings;

  return {
    [DOM_SINK]: $.of(
      div(".ui.left.breadcrumb", [
        a(".section", [`Home`]),
        i(".right.chevron.icon.divider"),
        div(".active.section", [`TODO`])
      ])
    )
  }
}
