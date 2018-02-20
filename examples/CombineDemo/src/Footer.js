import * as Rx from "rx";
import { Combine, InSlot } from "@rxcc/components"
import { DOM_SINK } from "@rxcc/utils"
import { div, a, h4, p, img } from "cycle-snabbdom"

const $ = Rx.Observable;

export const Footer = Combine({}, [FooterContainer, [
  InSlot('group1', [FooterGroup1]),
  InSlot('group2', [FooterGroup2]),
  InSlot('group3', [FooterGroup3]),
  InSlot('footer_header', [FooterHeader]),
  InSlot('sitemap', [Sitemap]),
]]);

function FooterGroup1(sources, settings){
  return {
    [DOM_SINK]: $.of(
      div([
        h4(".ui.inverted.header", [`Group 1`]),
        div(".ui.inverted.link.list", [
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link One`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Two`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Three`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Four`])
        ])
      ])
    )
  }
}

function FooterGroup2(sources, settings){
  return {
    [DOM_SINK]: $.of(
      div([
        h4(".ui.inverted.header", [`Group 2`]),
        div(".ui.inverted.link.list", [
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link One`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Two`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Three`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Four`])
        ])
      ])
    )
  }
}

function FooterGroup3(sources, settings){
  return {
    [DOM_SINK]: $.of(
      div([
        h4(".ui.inverted.header", [`Group 3`]),
        div(".ui.inverted.link.list", [
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link One`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Two`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Three`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Link Four`])
        ])
      ])
    )
  }
}

function FooterHeader(sources, settings){
  return {
    [DOM_SINK]: $.of(
      div([
        h4(".ui.inverted.header", [`Footer Header`]),
        p([`Extra space for a call to action inside the footer that could help re-engage users.`])
      ])
    )
  }
}

function Sitemap(sources, settings){
  return {
    [DOM_SINK]: $.of(
      div([
        div(".ui.inverted.section.divider"),
        img(".ui.centered.mini.image", {
          "attrs": {
            "src": "assets/images/logo.png",
          }
        }),
        div(".ui.horizontal.inverted.small.divided.link.list", [
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Site Map`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Contact Us`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Terms and Conditions`]),
          a(".item", {
            "attrs": {
              "href": "#",
            }
          }, [`Privacy Policy`])
        ])
      ])
    )
  }
}

function FooterContainer(sources, settings) {
  return {
    [DOM_SINK]: $.of(
      div([
        div(".ui.center.aligned.container", [
          div(".ui.stackable.inverted.divided.grid", [
            div(".three.wide.column", { slot: 'group1' }, []),
            div(".three.wide.column", { slot: 'group2' }, []),
            div(".three.wide.column", { slot: 'group3' }, []),
            div(".seven.wide.column", { slot: 'footer_header' }, [])
          ]),
          div({ "slot": "sitemap" }, [])
        ]),
      ])
    )
  }
}
