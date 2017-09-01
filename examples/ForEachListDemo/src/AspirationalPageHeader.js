import { DOM_SINK } from "../../../src/utils"
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
