import { Rx } from "rx"
import { div, form, h2, i, img, input } from 'cycle-snabbdom'
import { assertContract, DOM_SINK } from "../../../src/utils"
import { T } from "ramda"
import { LOG_IN } from "../drivers/auth"

const $ = Rx.Observable;
const isLoginSettings = T;

export function LoginPage(loginSettings) {
  assertContract(isLoginSettings, [loginSettings], `LoginPage: some error!`);

  return function LoginPage(sources, settings) {
    const loginIntent$ = sources.DOM.select('.login').events('click');

    const loginAction$ = loginIntent$.map(always({
      context: '',
      command: LOG_IN,
      payload: { username: sources.document.querySelector('.email').value }
    }));
    const redirectAction$ = source.auth$
      // filter out when user is not authenticated
      .filter(Boolean)
      // when user is authenticated, redirect
      .map(always(loginSettings.redirect))

    return {
      [DOM_SINK]: $.of(render()),
      auth$: loginAction$,
      router : redirectAction$
    }
  }
}

function render() {
  return div(".ui.middle.aligned.center.aligned.grid", [
    div(".column", [
      h2(".ui.teal.image.header", [
        img(".image", {
          "attributes": {
            "src": "assets/images/logo.png",
            "className": "image"
          }
        }),
        div(".content", [`Log-in to your account`])
      ]),
      form(".ui.large.form", [
        div(".ui.stacked.segment", [
          div(".field", [
            div(".ui.left.icon.input", [
              i(".user.icon"),
              input(".email", {
                "attributes": {
                  "type": "text",
                  "name": "email",
                  "placeholder": "E-mail address"
                }
              })
            ])
          ]),
          div(".field", [
            div(".ui.left.icon.input", [
              i(".lock.icon"),
              input({
                "attributes": {
                  "type": "password",
                  "name": "password",
                  "placeholder": "Password"
                }
              })
            ])
          ]),
          div(".ui.fluid.large.teal.submit.button.login", [`Login`])
        ]),
        div(".ui.error.message")
      ]),
    ])
  ])
}
