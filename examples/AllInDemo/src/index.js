import { App } from "./app"
import defaultModules from "cycle-snabbdom/lib/modules"
import { createHistory } from "history"
import firebase from 'firebase'
// drivers
import {
  makeAuthDriver,
  makeFirebaseDriver,
  makeQueueDriver,
} from '@sparksnetwork/cyclic-fire'
import { run } from "@cycle/core"
import { makeDOMDriver } from "cycle-snabbdom"
import { makeHistoryDriver} from '@cycle/history';
import { domainActionsConfig, domainObjectsQueryMap } from './domain/index';
import { inMemoryStoreQueryMap, inMemoryStoreActionsConfig } from './inMemoryStore';
import { makeDomainQueryDriver } from './domain/queryDriver/index';
import { makeDomainActionDriver } from './domain/actionDriver';
import { focusDriver } from '../../../src/drivers/focusDriver';
import { documentDriver} from '../../../src/drivers/documentDriver';
import {initLocallyPersistedState, initLocalNonPersistedState, initRemotelyPersistedState, initRepository} from './init'
// utils
import { DOM_SINK } from "../../../src/utils"

// Helpers
function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$
      .filter(Boolean)
    )
  }
}

const repository = initRepository(firebase);
const fbRoot = repository;
const inMemoryStore = initLocalNonPersistedState();

// Initialize database if empty
initRemotelyPersistedState(repository)
  .then(initLocallyPersistedState())
  .then(() => {
    const { sources, sinks } = run(App, {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules : defaultModules})),
      document: documentDriver,
      firebase: makeFirebaseDriver(fbRoot, {debug : true}),
      queue$: makeQueueDriver(fbRoot.child('!queue'), 'responses', 'tasks', {debug : true}),
      domainQuery: makeDomainQueryDriver(repository, domainObjectsQueryMap),
      domainAction$: makeDomainActionDriver(repository, domainActionsConfig),
      storeAccess: makeDomainQueryDriver(inMemoryStore, inMemoryStoreQueryMap),
      storeUpdate$: makeDomainActionDriver(inMemoryStore, inMemoryStoreActionsConfig),
      router: makeHistoryDriver(createHistory(), { capture: true }),
      focus : focusDriver
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
    console.error(`error while initializing application`, err);
  });
