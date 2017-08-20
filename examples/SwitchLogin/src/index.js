import { App } from "./app"
import { createHashHistory, createHistory } from "history"
import { makeRouterDriver, supportsHistory } from 'cyclic-router'
import defaultModules from "cycle-snabbdom/lib/modules"
import * as localForage from "localforage";
import * as Rx from "rx";
// drivers
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
import { loadTestData } from '../fixtures';
// utils
import { convertVNodesToHTML, DOM_SINK } from "../../../src/utils"
import { makeAuthDriver } from "../drivers/auth"

const $ = Rx.Observable;
const repository = localForage;
const modules = defaultModules;
const history = supportsHistory() ? createHistory() : createHashHistory();

// Helpers
// NOTE : only useful in connection with router, which is not used here
function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$
      .tap(x => console.warn(`merged DOM (driver input): ${convertVNodesToHTML(x)}`, x))
      .filter(x => x))
  }
}

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

    // Make auth drivers
    const {user$, authDriver} = makeAuthDriver(repository, initLoginState);

    const { sources, sinks } = run(App, {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules })),
      router: makeRouterDriver(history, { capture: true }),
      user$ : () => user$,
      auth$: authDriver,
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

