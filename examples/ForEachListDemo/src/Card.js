import { DOM_SINK } from "../../../src/utils"
import * as Rx from "rx";
import { a, div, i, img, span } from 'cycle-snabbdom'

const $ = Rx.Observable;

export function Card(sources, settings) {
  const { cardInfo, listIndex } = settings;
  debugger

  return {
    [DOM_SINK]: $.of(
      div(".column", [
        div(".ui.centered.fluid.card", [
          a(".ui.fluid.image.aspirational", {
            "attrs": {
              "href": `/${cardInfo.category}/${cardInfo.link}`,
              "className": "ui medium image"
            }
          }, [
            img({
              "attrs": {
                "src": `${cardInfo.src}`
              }
            })
          ]),
          div(".content", [
            div(".header.bds", [`${cardInfo.name}`]),
            div(".meta", [
              span(".date", [`${cardInfo.filter}`])
            ]),
            div(".description", [`${cardInfo.description}`])
          ]),
          div(".extra.content", [
            span(".right.floated", [
              i(".heart.outline.icon"),
              `${cardInfo.likes} likes`
            ]),
            span(".left.floated", [
              i(".comments.outline.icon"),
              ` ${cardInfo.comments} comments`
            ])
          ])
        ])
      ])
    )
      .tap(x => console.log(`Card > CardFragment > DOM`))
  }
}
