import * as Rx from "rx";
import { DOM_SINK } from "@rxcc/utils"
import { a, div, i, img } from "cycle-snabbdom"

const $ = Rx.Observable;

export function Header(sources, settings) {
  return {
    [DOM_SINK]: $.of(
      div(".ui.container", [
        a(".header.item", {
          "attrs": {
            "href": "#",
          }
        }, [
          img(".logo", {
            "attrs": {
              "src": "assets/images/logo.png",
            }
          }),
          `Project Name`
        ]),
        a(".item", {
          "attrs": {
            "href": "#",
          }
        }, [`Home`]),
        div(".ui.simple.dropdown.item", [
          `Dropdown `,
          i(".dropdown.icon"),
          div(".menu", [
            a(".item", {
              "attrs": {
                "href": "#",
              }
            }, [`Link Item`]),
            a(".item", {
              "attrs": {
                "href": "#",
              }
            }, [`Link Item`]),
            div(".divider"),
            div(".header", [`Header Item`]),
            div(".item", [
              i(".dropdown.icon"),
              `
            Sub Menu`,
              div(".menu", [
                a(".item", {
                  "attrs": {
                    "href": "#",
                  }
                }, [`Link Item`]),
                a(".item", {
                  "attrs": {
                    "href": "#",
                  }
                }, [`Link Item`])
              ])
            ]),
            a(".item", {
              "attrs": {
                "href": "#",
              }
            }, [`Link Item`])
          ])
        ])
      ])
    )
  }
}

