// Avoid `console` errors in browsers that lack a console.
(function () {
  let method;
  const noop = function () {};
  const methods = [
    'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
    'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
    'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
    'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
  ];
  let length = methods.length;
  let console = (window.console = window.console || {});

  while ( length-- ) {
    method = methods[length];

    // Only stub undefined methods.
    if (!console[method]) {
      console[method] = noop;
    }
  }
}());

import { m } from "./components/m"
// Change from m to RouteWhen or sth like that
// import {TODO} from './components/Router'
import { onRoute } from "./components/Router"
// change from m to Switch(CaseWhen...
// update the switch code too, it changed in between version
// TODO: also adapt the tests!!
//import {TODO} from './components/Switch'

export {
  m,
  onRoute,
  //TODO
}

export * from "./utils"
