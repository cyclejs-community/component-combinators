import { DOM_SINK } from "../../../src/utils"
import * as Rx from "rx";
import { a, div, i, img, p, strong } from 'cycle-snabbdom'
import { always } from 'ramda'

// NOTE : removed br, as it bugs with this version of cycle-snabbdom, or snabbdom

const $ = Rx.Observable;

function preventDefault(ev) {
  return ev.preventDefault()
}

export function HomePage(sources, settings) {
  const DOMSource = sources[DOM_SINK];
  const goToAspirationalIntent$ = DOMSource.select('a.aspirational').events('click').do(preventDefault)
    .map(always('/aspirational'));
  const goToGenXersIntent$ = DOMSource.select('a.genXers').events('click').do(preventDefault)
    .map(always('/genXers'));

  const routeActions$ = $.merge([goToAspirationalIntent$, goToGenXersIntent$]);

  return {
    router: routeActions$,
    [DOM_SINK]: $.of(
      div([
        div(".ui.breadcrumb", [
          div(".active.section", [`Home`])
        ]),
        div(".ui.yellow.message", [
          i(".star.icon"),
          `
    Please choose the category you want to delve into`
          ]),
          div(".ui.items", [
            div(".item", [
              a(".ui.medium.image", {
                "attrs": {
                  "href": "/Aspirational",
                  "className": "ui medium image"
                }
              }, [
                img({
                  "attrs": {
                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_6V8vERV3QPgteNYzXx7gxKwl4hOR2vKa_dJadIS7ZcvUaqWz"
                  }
                })
              ]),
              div(".content", [
                a(".header", [`Aspirational`]),
                div(".description", [
                  p([`This Aspirational generation isn’t defined by age, but rather the desire for their actions to meet their needs, have a positive impact on others and connect them with an ideal or community that’s bigger than themselves. Representing 39 percent of the global adult population, Aspirationals are connecting the right thing to do with the cool thing to do, creating new possibilities for brands, business and the society we share.`])
                ])
              ])
            ]),
            div(".item", [
              a(".ui.medium.image", {
                "attrs": {
                  "href": "/GenXers",
                  "className": "ui medium image"
                }
              }, [
                img({
                  "attrs": {
                    "src": "http://ichef.bbci.co.uk/wwfeatures/wm/live/1280_720/images/live/p0/4x/1w/p04x1wd3.jpg"
                  }
                })
              ]),
              div(".content", [
                a(".header", [`Gen Xers`]),
                div(".description", [
                  p([`Gen-Xers are artists. There are well-known Xer artists (director Quentin Tarantino and actors Julia Roberts and Brad Pitt come to mind), as well as those who are known only inside their own circles of expertise.Sarah Marks and Lori Kishlar regularly make the rounds of festival and craft shows with their macabre anime-like melamine dinnerware, prints and textiles.`])
                ])
              ])
            ]),
            div(".item", [
              a(".ui.medium.image", [
                img({
                  "attrs": {
                    "src": "https://i0.wp.com/luckyattitude.co.uk/wp-content/uploads/2015/05/millennials-characteristics.jpg?fit=485%2C323"
                  }
                })
              ]),
              div(".content", [
                a(".header", [`Millenials`]),
                div(".description", [
                  p([
                    strong([`Masters of the art of multi-tasking`]),
                    `, they are the first generation to grow up digesting and assimilating mass quantities of information at a time.
                    `,
//                    br(),
                    strong([`Tech-savvy:`]),
                    ` Millennials spend 5-10 hours a day consuming copious amount of online content.
                    `,
//                    br(),
                    strong([`Browsers not Buyers:`]),
                    ` Millennials spend more time browsing the internet for products than actually purchasing them.
                    `,
//                    br(),
                    strong([`Creative problem-solvers:`]),
                    ` With less linear techniques than previous generations, Millennials want to reach a decision fast and on their own terms.
                    `,
//                    br(),
                    strong([`Advice-Seekers:`]),
                    ` When deciding what to purchase, this demographic seeks opinions of friends, family members, or even strangers before making purchasing decisions.`
                  ])
                ])
              ])
            ])
          ])
        ]
      )
    )
  }
}
