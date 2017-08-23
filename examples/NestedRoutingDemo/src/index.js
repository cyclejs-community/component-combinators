import { App } from "./app"
import { createHistory } from "history"
import { makeRouterDriver } from 'cyclic-router'
import defaultModules from "cycle-snabbdom/lib/modules"
import * as localForage from "localforage";
import * as Rx from "rx";
// drivers
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
import { loadTestData } from '../fixtures';
// utils
import { DOM_SINK } from "../../../src/utils"
import { merge } from "ramda"

// TODO : I am here, thats the code for swtich demo, adaprt to router demo

const $ = Rx.Observable;
const repository = localForage;
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
// History driver
const history = createHistory();
const historyDriver = makeRouterDriver(history, { capture: true })

// Document driver
function documentDriver(_) {
  void _; // unused sink, this is a read-only driver

  return document
}

// Initialize the database
localForage._config = {
  driver: localForage.LOCALSTORAGE, // Force local storage;
  name: 'myApp',
  storeName: 'demo', // Should be alphanumeric, with underscores.
  description: 'emulation of remote storage in local for demo storage needs'
};

localForage.keys()
  .then(keys => Promise.all(keys.map(key => {
      return localForage.getItem(key).then(value => ({ [key]: value }))
    }
  )))
  .then(console.log.bind(console, `database content before`))
  .then(() => loadTestData(localForage))
  .then(() => localForage.getItem('user'))
  .then((initLoginState) => {

    const { sources, sinks } = run(init(App), {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules })),
      router: historyDriver,
      document: documentDriver
    });

    // Webpack specific code
    if (module.hot) {
      module.hot.accept();

      module.hot.dispose(() => {
        sinks.dispose()
        sources.dispose()
      });
    }
  })
  .catch(function (err) {
    console.log(`error while initializing database`, err);
  });

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

// TODO : solve error strong is not defined
