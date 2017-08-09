import { LOADING_USER_APPLICATION_DATA } from "./properties"
import { div } from "cycle-snabbdom";
import { Observable as $ } from "rx";

export function processApplicationRenderInit(sources, settings) {
  // This is a transient state - display some loading indicator
  return {
    DOM: $.just(div(LOADING_USER_APPLICATION_DATA))
  }
}
