import { App } from "./app"
import defaultModules from "cycle-snabbdom/lib/modules"
import { createHistory } from "history"
import { makeHistoryDriver } from '@cycle/history';
import * as Rx from "rx";
// drivers
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
// utils
import { DOM_SINK } from "@rxcc/utils"
import { merge } from "ramda"

const $ = Rx.Observable;
const modules = defaultModules;

// Helpers
function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$
      .filter(Boolean)
    )
  }
}

// Make drivers
// Document driver
function documentDriver(_) {
  void _; // unused sink, this is a read-only driver

  return document
}

const { sources, sinks } = run(init(App), {
  [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules })),
  router: makeHistoryDriver(createHistory(), { capture: true }),
  document: documentDriver,
});

// Webpack specific code
if (module.hot) {
  module.hot.accept();

  module.hot.dispose(() => {
    sinks.dispose()
    sources.dispose()
  });
}

// NOTE : convert html to snabbdom online to http://html-to-hyperscript.paqmind.com/
// ~~ attributes -> attrs

function init(App) {
  // NOTE : necessary in the context of the demo to put the initial route to /
  return function initApp(sources, settings) {
    const appSinks = App(sources, settings);

    return merge(appSinks, {
      router: $.concat([$.of('/'), appSinks.router])
    })
  }
}
