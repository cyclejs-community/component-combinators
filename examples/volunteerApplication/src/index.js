import { App } from "./app"
import { createHashHistory, createHistory } from "history"
import { makeRouterDriver, supportsHistory } from 'cyclic-router'
import defaultModules from "cycle-snabbdom/lib/modules"
import * as localForage from "localforage";
import { Observable as $ } from "rx";
// drivers
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
import { makeDomainActionDriver, makeDomainQueryDriver } from '@rxcc/drivers';
import { defaultUser, loadTestData } from '../fixtures';
// domain
import { domainActionsConfig, domainObjectsQueryMap } from './domain/index';
// utils
import { convertVNodesToHTML, DOM_SINK } from "@rxcc/utils"

const history = supportsHistory() ? createHistory() : createHashHistory();
const repository = localForage;
const modules = defaultModules;

// Helpers
// NOTE : only useful in connection with router, which is not used here
function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$
      .tap(x => console.log(`merged DOM (driver input): ${convertVNodesToHTML(x)}`, x))
      .filter(x => x))
  }
}

function documentDriver(_) {
  void _; // unused sink, this is a read-only driver

  return document
}

function makeFakeUserDriver(user) {
  return function fakeUserDriver() {
    // read-only driver, so no need for sink input parameter here
    return $.just(user)
  }
}

// Initialize the database
localForage.config({
  driver: localForage.LOCALSTORAGE, // Force local storage;
  name: 'myApp',
  storeName: 'demo', // Should be alphanumeric, with underscores.
  description: 'emulation of remote storage in local for demo storage needs'
});

Promise.resolve()
// NOTE : comment or uncomment the next line to reinitialize local storage
// .then(() => localForage.clear())
  .then(() => localForage.keys())
  .then(keys => Promise.all(keys.map(key => {
      return localForage.getItem(key).then(value => ({ [key]: value }))
    }
  )))
  .then(console.log.bind(console, `database content before`))
  .then(() => loadTestData(localForage))
  .then(() => {

    const { sources, sinks } = run(App, {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules })),
      router: makeRouterDriver(history, { capture: true }),
      user$: makeFakeUserDriver(defaultUser),
      domainQuery: makeDomainQueryDriver(repository, domainObjectsQueryMap),
      domainAction$: makeDomainActionDriver(repository, domainActionsConfig),
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
