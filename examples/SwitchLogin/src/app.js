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
  sinkNames: ['auth$', DOM_SINK, 'router'],
  trace : 'Switch'
}, [
  Case({ when: IS_LOGGED_IN, trace : 'MainPage Case' }, [
    MainPage // has a logout link...
  ]),
  Case({ when: IS_NOT_LOGGED_IN , trace : 'LoginPage Case'}, [
    LoginPage({ redirect: '/' }) // login page with login button TODO : settings not first arg
    // function coucou(){return ({DOM : $.of(p('coucou'))})}
  ]),
])

function convertAuthToIsLoggedIn(sources, settings) {
  // NOTE : auth$ contains the authenticated user, we only need to know whether that user is
  // logged in or not
  return sources.auth$
    .map(user => user ? IS_LOGGED_IN : IS_NOT_LOGGED_IN)
    .tap(x => console.warn('convertAuthToIsLoggedIn > sources.user$', x))
    .shareReplay(1)
}

// TODO DOC when using sources.source it must be sharedReplayed to avoid going back again to
// producing the value... NOT shared because they will connect at different moment?? dont now
// but does not work
