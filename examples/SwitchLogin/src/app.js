import { IS_LOGGED_IN, IS_NOT_LOGGED_IN } from "./properties"
import { Case, Switch } from "../../../src/components/Switch/Switch"
import { MainPage } from "./MainPage"
import { LoginPage } from "./LoginPage"
import { DOM_SINK } from "../../../src/utils"
import { p,  } from 'cycle-snabbdom'
import * as Rx from "rx";
const $ = Rx.Observable;

export const App = Switch({
  on: convertAuthToIsLoggedIn,
  sinkNames: ['auth$', DOM_SINK, 'router']
}, [
  Case({ when: IS_LOGGED_IN }, [
    MainPage // has a logout link...
  ]),
  Case({ when: IS_NOT_LOGGED_IN }, [
//    LoginPage({ redirect: '/' }) // login page with login button TODO : settings not first arg
    function coucou(){return ({DOM : $.of(p('coucou'))})}
  ]),
])

function convertAuthToIsLoggedIn(sources, settings) {
  // NOTE : auth$ contains the authenticated user, we only need to know whether that user is
  // logged in or not
  return sources.user$.map(user => user ? IS_LOGGED_IN : IS_NOT_LOGGED_IN)
    .tap(x => console.warn('sources.user$', x))
//    .share()
//    .shareReplay(1)
}
