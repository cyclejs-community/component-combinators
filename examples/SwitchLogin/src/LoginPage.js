import * as Rx from "rx";
import { div, form, h2, i, img, input } from 'cycle-snabbdom'
import { assertContract, convertVNodesToHTML, DOM_SINK } from "../../../src/utils"
import { T, pipe, always } from "ramda"
import { LOG_IN } from "../drivers/auth"

const $ = Rx.Observable;
const isLoginSettings = T;

export function LoginPage(loginSettings) {
  assertContract(isLoginSettings, [loginSettings], `LoginPage: some error!`);

  return function LoginPage(sources, settings) {
    const loginIntent$ = sources[DOM_SINK].select('.login').events('click');

    const loginAction$ = loginIntent$
      .filter(_ => {
        // NOTE : there are other ways to do this with HTML5, I just got lazy, that is just a demo
        return sources.document.querySelector('.email').value && sources.document.querySelector('.password').value
      })
      .map(x => ({
      context: '',
      command: LOG_IN,
      payload: { username: sources.document.querySelector('.email').value }
    }));
    const redirectAction$ = sources.auth$
      // filter out when user is not authenticated
      .filter(Boolean)
      // when user is authenticated, redirect
      .map(always(loginSettings.redirect));

    return {
      [DOM_SINK]: $.of(render()).tap(pipe(convertVNodesToHTML, console.warn.bind(console, 'LOGIN:'))),
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
              input(".password",{
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
