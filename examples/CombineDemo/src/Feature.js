import * as Rx from "rx";
import { DOM_SINK} from "@rxcc/utils"
import { a, div, h1, h2, img, nav, p, strong, ul } from "cycle-snabbdom"
import {App as Feature} from "../../NestedRoutingDemo/src/app"

const $ = Rx.Observable;


export function _Feature(sources, settings) {

  return {
    [DOM_SINK]: $.of(
      div([
        h1(".ui.header", [`Feature title`]),
        p([`In the context of this illustrative example, no feature is actually implemented. The Feature component only has DOM sinks.`]),
        p([`However, modifying the Feature component to include all kind of actions not related to the DOM would not change the surrounding code in any ways.`]),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/media-paragraph.png",
          }
        }),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/paragraph.png",
          }
        }),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/paragraph.png",
          }
        }),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/paragraph.png",
          }
        }),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/paragraph.png",
          }
        }),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/paragraph.png",
          }
        }),
        img(".wireframe", {
          "attrs": {
            "src": "assets/images/wireframe/paragraph.png",
          }
        })
      ])
    )
  }
}

export {Feature}
