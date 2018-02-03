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
      // TODO : add https://github.com/tmpvar/jsdom
      // https://github.com/tmpvar/jsdom/issues/1284,
      // https://github.com/snabbdom/snabbdom/issues/30 - have a DOM driver which return
      // document as DOM source, instead of cycle-dom-driver - see if that is compatible with
      // mock in runTestScenario (how to set input data??)
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


// 0. router source, should be just this, no driver, Rx.Observable.create
// let unlisten = history.listen((location) => {
// observer.next(location);
//});
// I already hav history (imported from npm package history)
// 1. import history-driver from cycle, I need the click capture. check that
// that is use cyclic-router 1.0.0
// check it works with capture settings
// 2. implements the route logic
// navigate to /apply
// navigate to /completed (!!I will have to update the fsm state entry component for STATE_APPLIED)
// 3. check database keys - use the same as in example
// 4. I will need query$: makeDomainQueryDriver(repository, queryConfig),
// 4. replace firebase by something else
// use rxdb
// copy firebase data to rxdb (dump?)
// adapt the makeDomainQueryDriver to that repository
// or pipelinedb https://www.pipelinedb.com/
// NO : use local storage : https://github.com/localForage/localForage
