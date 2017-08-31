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

export * from  "./components/m"
export * from "./components/Router/Router"
export * from "./utils"
export * from "./runTestScenario"

// TODO : Switch btw have the switch component pass not only the when to the children but the
// incomoing value too!! And add the corresponding test...
// TODO : change makeOwnSinks to ParentComponent somehow, probably [parent, [children]] is best API
// or [children] when there is no parent
// That way m only has the reducing functions, and can be curry in its first parameter
