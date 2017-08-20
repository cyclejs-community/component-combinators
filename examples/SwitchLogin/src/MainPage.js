import * as Rx from "rx";
import { DOM_SINK } from "../../../src/utils"
import { a, div, form, h1, h4, i, img, input, label, option, select } from 'cycle-snabbdom'
import { LOG_OUT } from "../drivers/auth"
import {always} from "ramda"

const $ = Rx.Observable;

export function MainPage(sources, settings) {
  const logoutIntent$ = sources[DOM_SINK].select('.logout').events('click');
  const logoutAction$ = logoutIntent$.map(always({
    context : '',
    command : LOG_OUT,
    payload : null
  }));

  return {
    [DOM_SINK]: sources.user$.map(render),
    auth$ : logoutAction$
  }
}

function render(user) {

  return div([
    div(".ui.large.top.fixed.hidden.menu", [
      div(".ui.container", [
        a(".active.item", [`Home`]),
        a(".item", [`Claims`]),
        a(".item", [`Eligibility`]),
        a(".item", [`My Account`]),
        a(".item", [`Knowledge Center`]),
        div(".right.menu", [
          div(".item", [
            a(".ui.button.logout", [`Logout`])
          ])
        ])
      ])
    ])
    /* Sidebar Menu */,
    div(".ui.vertical.inverted.sidebar.menu", [
      a(".active.item", [`Home`]),
      a(".item", [`Claims`]),
      a(".item", [`Eligibility`]),
      a(".item", [`My Account`]),
      a(".item", [`Knowledge Center`]),
      a(".item", [`Logout`])
    ]),
    div(".pusher", [
      div(".ui.inverted.vertical.masthead.segment", [
        div(".ui.container", [
          div(".ui.text.menu", [
            div(".ui.right.dropdown.item.item--white", [
              `Lauren Cutruzzula`,
              i(".dropdown.icon")
            ])
          ]),
          h1(".ui.inverted.header", [`Home`])
        ]),
        div(".ui.container", [
          div(".ui.secondary.inverted.pointing.menu", [
            a(".toc.item", [
              i(".sidebar.icon")
            ]),
            a(".active.item", [`Home`]),
            a(".item", [`Claims`]),
            a(".item", [`Eligibility`]),
            a(".item", [`My Account`]),
            a(".item", [`Knowledge Center`])
          ])
        ])
      ]),
      div(".ui.hidden.divider"),
      div(".ui.container", [
        div(".ui.breadcrumb", [
          a(".section", [`Home`]),
          i(".right.angle.icon.divider"),
          a(".section", [`Store`]),
          i(".right.angle.icon.divider"),
          div(".active.section", [`T-Shirt`])
        ])
      ]),
      div(".ui.hidden.divider"),
      form(".ui.container.large.equal.width.form.segment", [
        h4(".ui.dividing.header", [`Shipping Information`]),
        div(".field", [
          label([`Name`]),
          div(".two.fields", [
            div(".field", [
              input({
                "attributes": {
                  "type": "text",
                  "name": "shipping[first-name]",
                  "placeholder": "First Name"
                }
              })
            ]),
            div(".field", [
              input({
                "attributes": {
                  "type": "text",
                  "name": "shipping[last-name]",
                  "placeholder": "Last Name"
                }
              })
            ])
          ])
        ]),
        div(".field", [
          label([`Billing Address`]),
          div(".fields", [
            div(".twelve.wide.field", [
              input({
                "attributes": {
                  "type": "text",
                  "name": "shipping[address]",
                  "placeholder": "Street Address"
                }
              })
            ]),
            div(".four.wide.field", [
              input({
                "attributes": {
                  "type": "text",
                  "name": "shipping[address-2]",
                  "placeholder": "Apt #"
                }
              })
            ])
          ])
        ]),
        div(".two.fields", [
          div(".field", [
            label([`State`]),
            select(".ui.fluid.dropdown", [
              option({
                "attributes": {
                  "value": ""
                }
              }, [`State`]),
              option({
                "attributes": {
                  "value": "AL"
                }
              }, [`Alabama`]),
              option({
                "attributes": {
                  "value": "AK"
                }
              }, [`Alaska`]),
              option({
                "attributes": {
                  "value": "AZ"
                }
              }, [`Arizona`]),
              option({
                "attributes": {
                  "value": "AR"
                }
              }, [`Arkansas`]),
              option({
                "attributes": {
                  "value": "CA"
                }
              }, [`California`]),
              option({
                "attributes": {
                  "value": "CO"
                }
              }, [`Colorado`]),
              option({
                "attributes": {
                  "value": "CT"
                }
              }, [`Connecticut`]),
              option({
                "attributes": {
                  "value": "DE"
                }
              }, [`Delaware`]),
              option({
                "attributes": {
                  "value": "DC"
                }
              }, [`District Of Columbia`]),
              option({
                "attributes": {
                  "value": "FL"
                }
              }, [`Florida`]),
              option({
                "attributes": {
                  "value": "GA"
                }
              }, [`Georgia`]),
              option({
                "attributes": {
                  "value": "HI"
                }
              }, [`Hawaii`]),
              option({
                "attributes": {
                  "value": "ID"
                }
              }, [`Idaho`]),
              option({
                "attributes": {
                  "value": "IL"
                }
              }, [`Illinois`]),
              option({
                "attributes": {
                  "value": "IN"
                }
              }, [`Indiana`]),
              option({
                "attributes": {
                  "value": "IA"
                }
              }, [`Iowa`]),
              option({
                "attributes": {
                  "value": "KS"
                }
              }, [`Kansas`]),
              option({
                "attributes": {
                  "value": "KY"
                }
              }, [`Kentucky`]),
              option({
                "attributes": {
                  "value": "LA"
                }
              }, [`Louisiana`]),
              option({
                "attributes": {
                  "value": "ME"
                }
              }, [`Maine`]),
              option({
                "attributes": {
                  "value": "MD"
                }
              }, [`Maryland`]),
              option({
                "attributes": {
                  "value": "MA"
                }
              }, [`Massachusetts`]),
              option({
                "attributes": {
                  "value": "MI"
                }
              }, [`Michigan`]),
              option({
                "attributes": {
                  "value": "MN"
                }
              }, [`Minnesota`]),
              option({
                "attributes": {
                  "value": "MS"
                }
              }, [`Mississippi`]),
              option({
                "attributes": {
                  "value": "MO"
                }
              }, [`Missouri`]),
              option({
                "attributes": {
                  "value": "MT"
                }
              }, [`Montana`]),
              option({
                "attributes": {
                  "value": "NE"
                }
              }, [`Nebraska`]),
              option({
                "attributes": {
                  "value": "NV"
                }
              }, [`Nevada`]),
              option({
                "attributes": {
                  "value": "NH"
                }
              }, [`New Hampshire`]),
              option({
                "attributes": {
                  "value": "NJ"
                }
              }, [`New Jersey`]),
              option({
                "attributes": {
                  "value": "NM"
                }
              }, [`New Mexico`]),
              option({
                "attributes": {
                  "value": "NY"
                }
              }, [`New York`]),
              option({
                "attributes": {
                  "value": "NC"
                }
              }, [`North Carolina`]),
              option({
                "attributes": {
                  "value": "ND"
                }
              }, [`North Dakota`]),
              option({
                "attributes": {
                  "value": "OH"
                }
              }, [`Ohio`]),
              option({
                "attributes": {
                  "value": "OK"
                }
              }, [`Oklahoma`]),
              option({
                "attributes": {
                  "value": "OR"
                }
              }, [`Oregon`]),
              option({
                "attributes": {
                  "value": "PA"
                }
              }, [`Pennsylvania`]),
              option({
                "attributes": {
                  "value": "RI"
                }
              }, [`Rhode Island`]),
              option({
                "attributes": {
                  "value": "SC"
                }
              }, [`South Carolina`]),
              option({
                "attributes": {
                  "value": "SD"
                }
              }, [`South Dakota`]),
              option({
                "attributes": {
                  "value": "TN"
                }
              }, [`Tennessee`]),
              option({
                "attributes": {
                  "value": "TX"
                }
              }, [`Texas`]),
              option({
                "attributes": {
                  "value": "UT"
                }
              }, [`Utah`]),
              option({
                "attributes": {
                  "value": "VT"
                }
              }, [`Vermont`]),
              option({
                "attributes": {
                  "value": "VA"
                }
              }, [`Virginia`]),
              option({
                "attributes": {
                  "value": "WA"
                }
              }, [`Washington`]),
              option({
                "attributes": {
                  "value": "WV"
                }
              }, [`West Virginia`]),
              option({
                "attributes": {
                  "value": "WI"
                }
              }, [`Wisconsin`]),
              option({
                "attributes": {
                  "value": "WY"
                }
              }, [`Wyoming`])
            ])
          ]),
          div(".field", [
            label([`Country`]),
            div(".ui.fluid.search.selection.dropdown", [
              input({
                "attributes": {
                  "type": "hidden",
                  "name": "country"
                }
              }),
              i(".dropdown.icon"),
              div(".default.text", [`Select Country`]),
              div(".menu", [
                div(".item", {
                  "attributes": {
                    "data-value": "af",
                    "className": "item"
                  }
                }, [
                  i(".af.flag"),
                  `Afghanistan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ax",
                    "className": "item"
                  }
                }, [
                  i(".ax.flag"),
                  `Aland Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "al",
                    "className": "item"
                  }
                }, [
                  i(".al.flag"),
                  `Albania`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "dz",
                    "className": "item"
                  }
                }, [
                  i(".dz.flag"),
                  `Algeria`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "as",
                    "className": "item"
                  }
                }, [
                  i(".as.flag"),
                  `American Samoa`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ad",
                    "className": "item"
                  }
                }, [
                  i(".ad.flag"),
                  `Andorra`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ao",
                    "className": "item"
                  }
                }, [
                  i(".ao.flag"),
                  `Angola`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ai",
                    "className": "item"
                  }
                }, [
                  i(".ai.flag"),
                  `Anguilla`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ag",
                    "className": "item"
                  }
                }, [
                  i(".ag.flag"),
                  `Antigua`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ar",
                    "className": "item"
                  }
                }, [
                  i(".ar.flag"),
                  `Argentina`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "am",
                    "className": "item"
                  }
                }, [
                  i(".am.flag"),
                  `Armenia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "aw",
                    "className": "item"
                  }
                }, [
                  i(".aw.flag"),
                  `Aruba`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "au",
                    "className": "item"
                  }
                }, [
                  i(".au.flag"),
                  `Australia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "at",
                    "className": "item"
                  }
                }, [
                  i(".at.flag"),
                  `Austria`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "az",
                    "className": "item"
                  }
                }, [
                  i(".az.flag"),
                  `Azerbaijan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bs",
                    "className": "item"
                  }
                }, [
                  i(".bs.flag"),
                  `Bahamas`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bh",
                    "className": "item"
                  }
                }, [
                  i(".bh.flag"),
                  `Bahrain`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bd",
                    "className": "item"
                  }
                }, [
                  i(".bd.flag"),
                  `Bangladesh`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bb",
                    "className": "item"
                  }
                }, [
                  i(".bb.flag"),
                  `Barbados`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "by",
                    "className": "item"
                  }
                }, [
                  i(".by.flag"),
                  `Belarus`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "be",
                    "className": "item"
                  }
                }, [
                  i(".be.flag"),
                  `Belgium`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bz",
                    "className": "item"
                  }
                }, [
                  i(".bz.flag"),
                  `Belize`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bj",
                    "className": "item"
                  }
                }, [
                  i(".bj.flag"),
                  `Benin`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bm",
                    "className": "item"
                  }
                }, [
                  i(".bm.flag"),
                  `Bermuda`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bt",
                    "className": "item"
                  }
                }, [
                  i(".bt.flag"),
                  `Bhutan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bo",
                    "className": "item"
                  }
                }, [
                  i(".bo.flag"),
                  `Bolivia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ba",
                    "className": "item"
                  }
                }, [
                  i(".ba.flag"),
                  `Bosnia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bw",
                    "className": "item"
                  }
                }, [
                  i(".bw.flag"),
                  `Botswana`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bv",
                    "className": "item"
                  }
                }, [
                  i(".bv.flag"),
                  `Bouvet Island`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "br",
                    "className": "item"
                  }
                }, [
                  i(".br.flag"),
                  `Brazil`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "vg",
                    "className": "item"
                  }
                }, [
                  i(".vg.flag"),
                  `British Virgin Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bn",
                    "className": "item"
                  }
                }, [
                  i(".bn.flag"),
                  `Brunei`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bg",
                    "className": "item"
                  }
                }, [
                  i(".bg.flag"),
                  `Bulgaria`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bf",
                    "className": "item"
                  }
                }, [
                  i(".bf.flag"),
                  `Burkina Faso`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ar",
                    "className": "item"
                  }
                }, [
                  i(".ar.flag"),
                  `Burma`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "bi",
                    "className": "item"
                  }
                }, [
                  i(".bi.flag"),
                  `Burundi`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tc",
                    "className": "item"
                  }
                }, [
                  i(".tc.flag"),
                  `Caicos Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kh",
                    "className": "item"
                  }
                }, [
                  i(".kh.flag"),
                  `Cambodia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cm",
                    "className": "item"
                  }
                }, [
                  i(".cm.flag"),
                  `Cameroon`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ca",
                    "className": "item"
                  }
                }, [
                  i(".ca.flag"),
                  `Canada`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cv",
                    "className": "item"
                  }
                }, [
                  i(".cv.flag"),
                  `Cape Verde`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ky",
                    "className": "item"
                  }
                }, [
                  i(".ky.flag"),
                  `Cayman Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cf",
                    "className": "item"
                  }
                }, [
                  i(".cf.flag"),
                  `Central African Republic`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "td",
                    "className": "item"
                  }
                }, [
                  i(".td.flag"),
                  `Chad`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cl",
                    "className": "item"
                  }
                }, [
                  i(".cl.flag"),
                  `Chile`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cn",
                    "className": "item"
                  }
                }, [
                  i(".cn.flag"),
                  `China`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cx",
                    "className": "item"
                  }
                }, [
                  i(".cx.flag"),
                  `Christmas Island`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cc",
                    "className": "item"
                  }
                }, [
                  i(".cc.flag"),
                  `Cocos Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "co",
                    "className": "item"
                  }
                }, [
                  i(".co.flag"),
                  `Colombia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "km",
                    "className": "item"
                  }
                }, [
                  i(".km.flag"),
                  `Comoros`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cg",
                    "className": "item"
                  }
                }, [
                  i(".cg.flag"),
                  `Congo Brazzaville`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cd",
                    "className": "item"
                  }
                }, [
                  i(".cd.flag"),
                  `Congo`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ck",
                    "className": "item"
                  }
                }, [
                  i(".ck.flag"),
                  `Cook Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cr",
                    "className": "item"
                  }
                }, [
                  i(".cr.flag"),
                  `Costa Rica`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ci",
                    "className": "item"
                  }
                }, [
                  i(".ci.flag"),
                  `Cote Divoire`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "hr",
                    "className": "item"
                  }
                }, [
                  i(".hr.flag"),
                  `Croatia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cu",
                    "className": "item"
                  }
                }, [
                  i(".cu.flag"),
                  `Cuba`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cy",
                    "className": "item"
                  }
                }, [
                  i(".cy.flag"),
                  `Cyprus`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cz",
                    "className": "item"
                  }
                }, [
                  i(".cz.flag"),
                  `Czech Republic`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "dk",
                    "className": "item"
                  }
                }, [
                  i(".dk.flag"),
                  `Denmark`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "dj",
                    "className": "item"
                  }
                }, [
                  i(".dj.flag"),
                  `Djibouti`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "dm",
                    "className": "item"
                  }
                }, [
                  i(".dm.flag"),
                  `Dominica`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "do",
                    "className": "item"
                  }
                }, [
                  i(".do.flag"),
                  `Dominican Republic`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ec",
                    "className": "item"
                  }
                }, [
                  i(".ec.flag"),
                  `Ecuador`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "eg",
                    "className": "item"
                  }
                }, [
                  i(".eg.flag"),
                  `Egypt`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sv",
                    "className": "item"
                  }
                }, [
                  i(".sv.flag"),
                  `El Salvador`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gb",
                    "className": "item"
                  }
                }, [
                  i(".gb.flag"),
                  `England`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gq",
                    "className": "item"
                  }
                }, [
                  i(".gq.flag"),
                  `Equatorial Guinea`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "er",
                    "className": "item"
                  }
                }, [
                  i(".er.flag"),
                  `Eritrea`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ee",
                    "className": "item"
                  }
                }, [
                  i(".ee.flag"),
                  `Estonia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "et",
                    "className": "item"
                  }
                }, [
                  i(".et.flag"),
                  `Ethiopia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "eu",
                    "className": "item"
                  }
                }, [
                  i(".eu.flag"),
                  `European Union`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "fk",
                    "className": "item"
                  }
                }, [
                  i(".fk.flag"),
                  `Falkland Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "fo",
                    "className": "item"
                  }
                }, [
                  i(".fo.flag"),
                  `Faroe Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "fj",
                    "className": "item"
                  }
                }, [
                  i(".fj.flag"),
                  `Fiji`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "fi",
                    "className": "item"
                  }
                }, [
                  i(".fi.flag"),
                  `Finland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "fr",
                    "className": "item"
                  }
                }, [
                  i(".fr.flag"),
                  `France`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gf",
                    "className": "item"
                  }
                }, [
                  i(".gf.flag"),
                  `French Guiana`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pf",
                    "className": "item"
                  }
                }, [
                  i(".pf.flag"),
                  `French Polynesia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tf",
                    "className": "item"
                  }
                }, [
                  i(".tf.flag"),
                  `French Territories`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ga",
                    "className": "item"
                  }
                }, [
                  i(".ga.flag"),
                  `Gabon`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gm",
                    "className": "item"
                  }
                }, [
                  i(".gm.flag"),
                  `Gambia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ge",
                    "className": "item"
                  }
                }, [
                  i(".ge.flag"),
                  `Georgia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "de",
                    "className": "item"
                  }
                }, [
                  i(".de.flag"),
                  `Germany`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gh",
                    "className": "item"
                  }
                }, [
                  i(".gh.flag"),
                  `Ghana`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gi",
                    "className": "item"
                  }
                }, [
                  i(".gi.flag"),
                  `Gibraltar`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gr",
                    "className": "item"
                  }
                }, [
                  i(".gr.flag"),
                  `Greece`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gl",
                    "className": "item"
                  }
                }, [
                  i(".gl.flag"),
                  `Greenland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gd",
                    "className": "item"
                  }
                }, [
                  i(".gd.flag"),
                  `Grenada`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gp",
                    "className": "item"
                  }
                }, [
                  i(".gp.flag"),
                  `Guadeloupe`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gu",
                    "className": "item"
                  }
                }, [
                  i(".gu.flag"),
                  `Guam`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gt",
                    "className": "item"
                  }
                }, [
                  i(".gt.flag"),
                  `Guatemala`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gw",
                    "className": "item"
                  }
                }, [
                  i(".gw.flag"),
                  `Guinea-Bissau`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gn",
                    "className": "item"
                  }
                }, [
                  i(".gn.flag"),
                  `Guinea`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gy",
                    "className": "item"
                  }
                }, [
                  i(".gy.flag"),
                  `Guyana`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ht",
                    "className": "item"
                  }
                }, [
                  i(".ht.flag"),
                  `Haiti`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "hm",
                    "className": "item"
                  }
                }, [
                  i(".hm.flag"),
                  `Heard Island`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "hn",
                    "className": "item"
                  }
                }, [
                  i(".hn.flag"),
                  `Honduras`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "hk",
                    "className": "item"
                  }
                }, [
                  i(".hk.flag"),
                  `Hong Kong`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "hu",
                    "className": "item"
                  }
                }, [
                  i(".hu.flag"),
                  `Hungary`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "is",
                    "className": "item"
                  }
                }, [
                  i(".is.flag"),
                  `Iceland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "in",
                    "className": "item"
                  }
                }, [
                  i(".in.flag"),
                  `India`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "io",
                    "className": "item"
                  }
                }, [
                  i(".io.flag"),
                  `Indian Ocean Territory`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "id",
                    "className": "item"
                  }
                }, [
                  i(".id.flag"),
                  `Indonesia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ir",
                    "className": "item"
                  }
                }, [
                  i(".ir.flag"),
                  `Iran`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "iq",
                    "className": "item"
                  }
                }, [
                  i(".iq.flag"),
                  `Iraq`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ie",
                    "className": "item"
                  }
                }, [
                  i(".ie.flag"),
                  `Ireland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "il",
                    "className": "item"
                  }
                }, [
                  i(".il.flag"),
                  `Israel`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "it",
                    "className": "item"
                  }
                }, [
                  i(".it.flag"),
                  `Italy`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "jm",
                    "className": "item"
                  }
                }, [
                  i(".jm.flag"),
                  `Jamaica`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "jp",
                    "className": "item"
                  }
                }, [
                  i(".jp.flag"),
                  `Japan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "jo",
                    "className": "item"
                  }
                }, [
                  i(".jo.flag"),
                  `Jordan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kz",
                    "className": "item"
                  }
                }, [
                  i(".kz.flag"),
                  `Kazakhstan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ke",
                    "className": "item"
                  }
                }, [
                  i(".ke.flag"),
                  `Kenya`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ki",
                    "className": "item"
                  }
                }, [
                  i(".ki.flag"),
                  `Kiribati`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kw",
                    "className": "item"
                  }
                }, [
                  i(".kw.flag"),
                  `Kuwait`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kg",
                    "className": "item"
                  }
                }, [
                  i(".kg.flag"),
                  `Kyrgyzstan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "la",
                    "className": "item"
                  }
                }, [
                  i(".la.flag"),
                  `Laos`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lv",
                    "className": "item"
                  }
                }, [
                  i(".lv.flag"),
                  `Latvia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lb",
                    "className": "item"
                  }
                }, [
                  i(".lb.flag"),
                  `Lebanon`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ls",
                    "className": "item"
                  }
                }, [
                  i(".ls.flag"),
                  `Lesotho`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lr",
                    "className": "item"
                  }
                }, [
                  i(".lr.flag"),
                  `Liberia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ly",
                    "className": "item"
                  }
                }, [
                  i(".ly.flag"),
                  `Libya`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "li",
                    "className": "item"
                  }
                }, [
                  i(".li.flag"),
                  `Liechtenstein`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lt",
                    "className": "item"
                  }
                }, [
                  i(".lt.flag"),
                  `Lithuania`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lu",
                    "className": "item"
                  }
                }, [
                  i(".lu.flag"),
                  `Luxembourg`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mo",
                    "className": "item"
                  }
                }, [
                  i(".mo.flag"),
                  `Macau`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mk",
                    "className": "item"
                  }
                }, [
                  i(".mk.flag"),
                  `Macedonia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mg",
                    "className": "item"
                  }
                }, [
                  i(".mg.flag"),
                  `Madagascar`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mw",
                    "className": "item"
                  }
                }, [
                  i(".mw.flag"),
                  `Malawi`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "my",
                    "className": "item"
                  }
                }, [
                  i(".my.flag"),
                  `Malaysia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mv",
                    "className": "item"
                  }
                }, [
                  i(".mv.flag"),
                  `Maldives`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ml",
                    "className": "item"
                  }
                }, [
                  i(".ml.flag"),
                  `Mali`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mt",
                    "className": "item"
                  }
                }, [
                  i(".mt.flag"),
                  `Malta`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mh",
                    "className": "item"
                  }
                }, [
                  i(".mh.flag"),
                  `Marshall Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mq",
                    "className": "item"
                  }
                }, [
                  i(".mq.flag"),
                  `Martinique`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mr",
                    "className": "item"
                  }
                }, [
                  i(".mr.flag"),
                  `Mauritania`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mu",
                    "className": "item"
                  }
                }, [
                  i(".mu.flag"),
                  `Mauritius`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "yt",
                    "className": "item"
                  }
                }, [
                  i(".yt.flag"),
                  `Mayotte`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mx",
                    "className": "item"
                  }
                }, [
                  i(".mx.flag"),
                  `Mexico`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "fm",
                    "className": "item"
                  }
                }, [
                  i(".fm.flag"),
                  `Micronesia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "md",
                    "className": "item"
                  }
                }, [
                  i(".md.flag"),
                  `Moldova`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mc",
                    "className": "item"
                  }
                }, [
                  i(".mc.flag"),
                  `Monaco`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mn",
                    "className": "item"
                  }
                }, [
                  i(".mn.flag"),
                  `Mongolia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "me",
                    "className": "item"
                  }
                }, [
                  i(".me.flag"),
                  `Montenegro`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ms",
                    "className": "item"
                  }
                }, [
                  i(".ms.flag"),
                  `Montserrat`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ma",
                    "className": "item"
                  }
                }, [
                  i(".ma.flag"),
                  `Morocco`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mz",
                    "className": "item"
                  }
                }, [
                  i(".mz.flag"),
                  `Mozambique`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "na",
                    "className": "item"
                  }
                }, [
                  i(".na.flag"),
                  `Namibia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "nr",
                    "className": "item"
                  }
                }, [
                  i(".nr.flag"),
                  `Nauru`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "np",
                    "className": "item"
                  }
                }, [
                  i(".np.flag"),
                  `Nepal`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "an",
                    "className": "item"
                  }
                }, [
                  i(".an.flag"),
                  `Netherlands Antilles`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "nl",
                    "className": "item"
                  }
                }, [
                  i(".nl.flag"),
                  `Netherlands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "nc",
                    "className": "item"
                  }
                }, [
                  i(".nc.flag"),
                  `New Caledonia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pg",
                    "className": "item"
                  }
                }, [
                  i(".pg.flag"),
                  `New Guinea`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "nz",
                    "className": "item"
                  }
                }, [
                  i(".nz.flag"),
                  `New Zealand`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ni",
                    "className": "item"
                  }
                }, [
                  i(".ni.flag"),
                  `Nicaragua`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ne",
                    "className": "item"
                  }
                }, [
                  i(".ne.flag"),
                  `Niger`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ng",
                    "className": "item"
                  }
                }, [
                  i(".ng.flag"),
                  `Nigeria`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "nu",
                    "className": "item"
                  }
                }, [
                  i(".nu.flag"),
                  `Niue`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "nf",
                    "className": "item"
                  }
                }, [
                  i(".nf.flag"),
                  `Norfolk Island`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kp",
                    "className": "item"
                  }
                }, [
                  i(".kp.flag"),
                  `North Korea`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "mp",
                    "className": "item"
                  }
                }, [
                  i(".mp.flag"),
                  `Northern Mariana Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "no",
                    "className": "item"
                  }
                }, [
                  i(".no.flag"),
                  `Norway`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "om",
                    "className": "item"
                  }
                }, [
                  i(".om.flag"),
                  `Oman`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pk",
                    "className": "item"
                  }
                }, [
                  i(".pk.flag"),
                  `Pakistan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pw",
                    "className": "item"
                  }
                }, [
                  i(".pw.flag"),
                  `Palau`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ps",
                    "className": "item"
                  }
                }, [
                  i(".ps.flag"),
                  `Palestine`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pa",
                    "className": "item"
                  }
                }, [
                  i(".pa.flag"),
                  `Panama`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "py",
                    "className": "item"
                  }
                }, [
                  i(".py.flag"),
                  `Paraguay`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pe",
                    "className": "item"
                  }
                }, [
                  i(".pe.flag"),
                  `Peru`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ph",
                    "className": "item"
                  }
                }, [
                  i(".ph.flag"),
                  `Philippines`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pn",
                    "className": "item"
                  }
                }, [
                  i(".pn.flag"),
                  `Pitcairn Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pl",
                    "className": "item"
                  }
                }, [
                  i(".pl.flag"),
                  `Poland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pt",
                    "className": "item"
                  }
                }, [
                  i(".pt.flag"),
                  `Portugal`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pr",
                    "className": "item"
                  }
                }, [
                  i(".pr.flag"),
                  `Puerto Rico`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "qa",
                    "className": "item"
                  }
                }, [
                  i(".qa.flag"),
                  `Qatar`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "re",
                    "className": "item"
                  }
                }, [
                  i(".re.flag"),
                  `Reunion`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ro",
                    "className": "item"
                  }
                }, [
                  i(".ro.flag"),
                  `Romania`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ru",
                    "className": "item"
                  }
                }, [
                  i(".ru.flag"),
                  `Russia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "rw",
                    "className": "item"
                  }
                }, [
                  i(".rw.flag"),
                  `Rwanda`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sh",
                    "className": "item"
                  }
                }, [
                  i(".sh.flag"),
                  `Saint Helena`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kn",
                    "className": "item"
                  }
                }, [
                  i(".kn.flag"),
                  `Saint Kitts and Nevis`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lc",
                    "className": "item"
                  }
                }, [
                  i(".lc.flag"),
                  `Saint Lucia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "pm",
                    "className": "item"
                  }
                }, [
                  i(".pm.flag"),
                  `Saint Pierre`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "vc",
                    "className": "item"
                  }
                }, [
                  i(".vc.flag"),
                  `Saint Vincent`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ws",
                    "className": "item"
                  }
                }, [
                  i(".ws.flag"),
                  `Samoa`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sm",
                    "className": "item"
                  }
                }, [
                  i(".sm.flag"),
                  `San Marino`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "gs",
                    "className": "item"
                  }
                }, [
                  i(".gs.flag"),
                  `Sandwich Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "st",
                    "className": "item"
                  }
                }, [
                  i(".st.flag"),
                  `Sao Tome`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sa",
                    "className": "item"
                  }
                }, [
                  i(".sa.flag"),
                  `Saudi Arabia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sn",
                    "className": "item"
                  }
                }, [
                  i(".sn.flag"),
                  `Senegal`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "cs",
                    "className": "item"
                  }
                }, [
                  i(".cs.flag"),
                  `Serbia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "rs",
                    "className": "item"
                  }
                }, [
                  i(".rs.flag"),
                  `Serbia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sc",
                    "className": "item"
                  }
                }, [
                  i(".sc.flag"),
                  `Seychelles`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sl",
                    "className": "item"
                  }
                }, [
                  i(".sl.flag"),
                  `Sierra Leone`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sg",
                    "className": "item"
                  }
                }, [
                  i(".sg.flag"),
                  `Singapore`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sk",
                    "className": "item"
                  }
                }, [
                  i(".sk.flag"),
                  `Slovakia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "si",
                    "className": "item"
                  }
                }, [
                  i(".si.flag"),
                  `Slovenia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sb",
                    "className": "item"
                  }
                }, [
                  i(".sb.flag"),
                  `Solomon Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "so",
                    "className": "item"
                  }
                }, [
                  i(".so.flag"),
                  `Somalia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "za",
                    "className": "item"
                  }
                }, [
                  i(".za.flag"),
                  `South Africa`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "kr",
                    "className": "item"
                  }
                }, [
                  i(".kr.flag"),
                  `South Korea`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "es",
                    "className": "item"
                  }
                }, [
                  i(".es.flag"),
                  `Spain`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "lk",
                    "className": "item"
                  }
                }, [
                  i(".lk.flag"),
                  `Sri Lanka`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sd",
                    "className": "item"
                  }
                }, [
                  i(".sd.flag"),
                  `Sudan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sr",
                    "className": "item"
                  }
                }, [
                  i(".sr.flag"),
                  `Suriname`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sj",
                    "className": "item"
                  }
                }, [
                  i(".sj.flag"),
                  `Svalbard`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sz",
                    "className": "item"
                  }
                }, [
                  i(".sz.flag"),
                  `Swaziland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "se",
                    "className": "item"
                  }
                }, [
                  i(".se.flag"),
                  `Sweden`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ch",
                    "className": "item"
                  }
                }, [
                  i(".ch.flag"),
                  `Switzerland`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "sy",
                    "className": "item"
                  }
                }, [
                  i(".sy.flag"),
                  `Syria`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tw",
                    "className": "item"
                  }
                }, [
                  i(".tw.flag"),
                  `Taiwan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tj",
                    "className": "item"
                  }
                }, [
                  i(".tj.flag"),
                  `Tajikistan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tz",
                    "className": "item"
                  }
                }, [
                  i(".tz.flag"),
                  `Tanzania`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "th",
                    "className": "item"
                  }
                }, [
                  i(".th.flag"),
                  `Thailand`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tl",
                    "className": "item"
                  }
                }, [
                  i(".tl.flag"),
                  `Timorleste`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tg",
                    "className": "item"
                  }
                }, [
                  i(".tg.flag"),
                  `Togo`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tk",
                    "className": "item"
                  }
                }, [
                  i(".tk.flag"),
                  `Tokelau`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "to",
                    "className": "item"
                  }
                }, [
                  i(".to.flag"),
                  `Tonga`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tt",
                    "className": "item"
                  }
                }, [
                  i(".tt.flag"),
                  `Trinidad`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tn",
                    "className": "item"
                  }
                }, [
                  i(".tn.flag"),
                  `Tunisia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tr",
                    "className": "item"
                  }
                }, [
                  i(".tr.flag"),
                  `Turkey`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tm",
                    "className": "item"
                  }
                }, [
                  i(".tm.flag"),
                  `Turkmenistan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "tv",
                    "className": "item"
                  }
                }, [
                  i(".tv.flag"),
                  `Tuvalu`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ug",
                    "className": "item"
                  }
                }, [
                  i(".ug.flag"),
                  `Uganda`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ua",
                    "className": "item"
                  }
                }, [
                  i(".ua.flag"),
                  `Ukraine`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ae",
                    "className": "item"
                  }
                }, [
                  i(".ae.flag"),
                  `United Arab Emirates`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "us",
                    "className": "item"
                  }
                }, [
                  i(".us.flag"),
                  `United States`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "uy",
                    "className": "item"
                  }
                }, [
                  i(".uy.flag"),
                  `Uruguay`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "um",
                    "className": "item"
                  }
                }, [
                  i(".um.flag"),
                  `Us Minor Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "vi",
                    "className": "item"
                  }
                }, [
                  i(".vi.flag"),
                  `Us Virgin Islands`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "uz",
                    "className": "item"
                  }
                }, [
                  i(".uz.flag"),
                  `Uzbekistan`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "vu",
                    "className": "item"
                  }
                }, [
                  i(".vu.flag"),
                  `Vanuatu`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "va",
                    "className": "item"
                  }
                }, [
                  i(".va.flag"),
                  `Vatican City`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ve",
                    "className": "item"
                  }
                }, [
                  i(".ve.flag"),
                  `Venezuela`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "vn",
                    "className": "item"
                  }
                }, [
                  i(".vn.flag"),
                  `Vietnam`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "wf",
                    "className": "item"
                  }
                }, [
                  i(".wf.flag"),
                  `Wallis and Futuna`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "eh",
                    "className": "item"
                  }
                }, [
                  i(".eh.flag"),
                  `Western Sahara`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "ye",
                    "className": "item"
                  }
                }, [
                  i(".ye.flag"),
                  `Yemen`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "zm",
                    "className": "item"
                  }
                }, [
                  i(".zm.flag"),
                  `Zambia`
                ]),
                div(".item", {
                  "attributes": {
                    "data-value": "zw",
                    "className": "item"
                  }
                }, [
                  i(".zw.flag"),
                  `Zimbabwe`
                ])
              ])
            ])
          ])
        ]),
        h4(".ui.dividing.header", [`Billing Information`]),
        div(".field", [
          label([`Card Type`]),
          div(".ui.selection.dropdown", [
            input({
              "attributes": {
                "type": "hidden",
                "name": "card[type]"
              }
            }),
            div(".default.text", [`Type`]),
            i(".dropdown.icon"),
            div(".menu", [
              div(".item", {
                "attributes": {
                  "data-value": "visa",
                  "className": "item"
                }
              }, [
                i(".visa.icon"),
                `Visa`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "amex",
                  "className": "item"
                }
              }, [
                i(".amex.icon"),
                `American Express`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "discover",
                  "className": "item"
                }
              }, [
                i(".discover.icon"),
                `Discover`
              ])
            ])
          ])
        ]),
        div(".fields", [
          div(".seven.wide.field", [
            label([`Card Number`]),
            input({
              "attributes": {
                "type": "text",
                "name": "card[number]",
                "maxlength": "16",
                "placeholder": "Card #"
              }
            })
          ]),
          div(".three.wide.field", [
            label([`CVC`]),
            input({
              "attributes": {
                "type": "text",
                "name": "card[cvc]",
                "maxlength": "3",
                "placeholder": "CVC"
              }
            })
          ]),
          div(".six.wide.field", [
            label([`Expiration`]),
            div(".two.fields", [
              div(".field", [
                select(".ui.fluid.search.dropdown", {
                  "attributes": {
                    "name": "card[expire-month]",
                    "className": "ui fluid search dropdown"
                  }
                }, [
                  option({
                    "attributes": {
                      "value": ""
                    }
                  }, [`Month`]),
                  option({
                    "attributes": {
                      "value": "1"
                    }
                  }, [`January`]),
                  option({
                    "attributes": {
                      "value": "2"
                    }
                  }, [`February`]),
                  option({
                    "attributes": {
                      "value": "3"
                    }
                  }, [`March`]),
                  option({
                    "attributes": {
                      "value": "4"
                    }
                  }, [`April`]),
                  option({
                    "attributes": {
                      "value": "5"
                    }
                  }, [`May`]),
                  option({
                    "attributes": {
                      "value": "6"
                    }
                  }, [`June`]),
                  option({
                    "attributes": {
                      "value": "7"
                    }
                  }, [`July`]),
                  option({
                    "attributes": {
                      "value": "8"
                    }
                  }, [`August`]),
                  option({
                    "attributes": {
                      "value": "9"
                    }
                  }, [`September`]),
                  option({
                    "attributes": {
                      "value": "10"
                    }
                  }, [`October`]),
                  option({
                    "attributes": {
                      "value": "11"
                    }
                  }, [`November`]),
                  option({
                    "attributes": {
                      "value": "12"
                    }
                  }, [`December`])
                ])
              ]),
              div(".field", [
                input({
                  "attributes": {
                    "type": "text",
                    "name": "card[expire-year]",
                    "maxlength": "4",
                    "placeholder": "Year"
                  }
                })
              ])
            ])
          ])
        ]),
        h4(".ui.dividing.header", [`Receipt`]),
        div(".field", [
          label([`Send Receipt To:`]),
          div(".ui.fluid.multiple.search.selection.dropdown", [
            input({
              "attributes": {
                "type": "hidden",
                "name": "receipt"
              }
            }),
            i(".dropdown.icon"),
            div(".default.text", [`Saved Contacts`]),
            div(".menu", [
              div(".item", {
                "attributes": {
                  "data-value": "jenny",
                  "data-text": "Jenny",
                  "className": "item"
                }
              }, [
                img(".ui.mini.avatar.image", {
                  "attributes": {
                    "src": "/images/avatar/small/jenny.jpg",
                    "className": "ui mini avatar image"
                  }
                }),
                `Jenny Hess`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "elliot",
                  "data-text": "Elliot",
                  "className": "item"
                }
              }, [
                img(".ui.mini.avatar.image", {
                  "attributes": {
                    "src": "/images/avatar/small/elliot.jpg",
                    "className": "ui mini avatar image"
                  }
                }),
                `Elliot Fu`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "stevie",
                  "data-text": "Stevie",
                  "className": "item"
                }
              }, [
                img(".ui.mini.avatar.image", {
                  "attributes": {
                    "src": "/images/avatar/small/stevie.jpg",
                    "className": "ui mini avatar image"
                  }
                }),
                `Stevie Feliciano`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "christian",
                  "data-text": "Christian",
                  "className": "item"
                }
              }, [
                img(".ui.mini.avatar.image", {
                  "attributes": {
                    "src": "/images/avatar/small/christian.jpg",
                    "className": "ui mini avatar image"
                  }
                }),
                `Christian`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "matt",
                  "data-text": "Matt",
                  "className": "item"
                }
              }, [
                img(".ui.mini.avatar.image", {
                  "attributes": {
                    "src": "/images/avatar/small/matt.jpg",
                    "className": "ui mini avatar image"
                  }
                }),
                `Matt`
              ]),
              div(".item", {
                "attributes": {
                  "data-value": "justen",
                  "data-text": "Justen",
                  "className": "item"
                }
              }, [
                img(".ui.mini.avatar.image", {
                  "attributes": {
                    "src": "/images/avatar/small/justen.jpg",
                    "className": "ui mini avatar image"
                  }
                }),
                `Justen Kitsune`
              ])
            ])
          ])
        ]),
        div(".ui.segment", [
          div(".field", [
            div(".ui.toggle.checkbox", [
              input(".hidden", {
                "attributes": {
                  "type": "checkbox",
                  "name": "gift",
                  "tabindex": "0",
                  "className": "hidden"
                }
              }),
              label([`Do not include a receipt in the package`])
            ])
          ])
        ]),
        div(".ui.button", {
          "attributes": {
            "tabindex": "0",
            "className": "ui button"
          }
        }, [`Submit Order`])
      ]),
      div(".ui.container.form.segment", [
        div(".fields", [
          div(".six.wide.field", [
            label([`First name`]),
            input({
              "attributes": {
                "type": "text",
                "placeholder": "First Name"
              }
            })
          ]),
          div(".four.wide.field", [
            label([`Middle`]),
            input({
              "attributes": {
                "type": "text",
                "placeholder": "Middle Name"
              }
            })
          ]),
          div(".six.wide.field", [
            label([`Last name`]),
            input({
              "attributes": {
                "type": "text",
                "placeholder": "Last Name"
              }
            })
          ])
        ]),
        div(".fields", [
          div(".two.wide.field", [
            input({
              "attributes": {
                "type": "text",
                "placeholder": "2 Wide"
              }
            })
          ]),
          div(".twelve.wide.field", [
            input({
              "attributes": {
                "type": "text",
                "placeholder": "12 Wide"
              }
            })
          ]),
          div(".two.wide.field", [
            input({
              "attributes": {
                "type": "text",
                "placeholder": "2 Wide"
              }
            })
          ])
        ]),
        div(".fields", [
          div(".eight.wide.field", [
            input({
              "attributes": {
                "type": "text",
                "placeholder": "8 Wide"
              }
            })
          ]),
          div(".six.wide.field", [
            input({
              "attributes": {
                "type": "text",
                "placeholder": "6 Wide"
              }
            })
          ]),
          div(".two.wide.field", [
            input({
              "attributes": {
                "type": "text",
                "placeholder": "2 Wide"
              }
            })
          ])
        ])
      ])
    ])
  ])
}

