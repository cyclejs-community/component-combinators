import { App } from "./app"
import defaultModules from "cycle-snabbdom/lib/modules"
import firebase from 'firebase'
// drivers
import {
  makeAuthDriver,
  makeFirebaseDriver,
  makeQueueDriver,
} from '@sparksnetwork/cyclic-fire'
import * as Rx from "rx";
import { run } from "@cycle/core"
import { makeDOMDriver } from "cycle-snabbdom"
import { domainActionsConfig, domainObjectsQueryMap } from './domain/index';
import { makeDomainQueryDriver } from './domain/queryDriver/index';
import { makeDomainActionDriver } from './domain/actionDriver/index';
// Fixtures
import { loadTestData } from '../fixtures';
// utils
import { DOM_SINK } from "../../../src/utils"
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

// TODO Initialize the database - for this demo I do not use local storage but I keep this anyways
// TODO : first use user dummy, then have a proper login page, maybe with firebase auth
// TODO : NOTE firebase loin auth already made in sparks-frontend brnach forgot-pwd-w-combinator...
try {
  firebase.app()
} catch (err) {
  firebase.initializeApp({
    apiKey: "AIzaSyC1Z28faFhKZqf0QBs0qSKBod3W_GZgwL8",
    authDomain: "cycle-m-component-demo-app.firebaseapp.com",
    databaseURL: "https://cycle-m-component-demo-app.firebaseio.com",
    projectId: "cycle-m-component-demo-app",
    storageBucket: "cycle-m-component-demo-app.appspot.com",
    messagingSenderId: "758278666357"
  })
}
const fbRoot = firebase.database().ref()
const repository = fbRoot

localForage.keys()
  .then(keys => Promise.all(keys.map(key => {
      return localForage.getItem(key).then(value => ({ [key]: value }))
    }
  )))
  .then((initLoginState) => {

    const { sources, sinks } = run(App, {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules })),
      document: documentDriver,
      firebase: makeFirebaseDriver(fbRoot, {debug : true}),
      queue$: makeQueueDriver(fbRoot.child('!queue'), 'responses', 'tasks', {debug : true}),
      domainQuery: makeDomainQueryDriver(repository, domainObjectsQueryMap),
      domainAction$: makeDomainActionDriver(repository, domainActionsConfig),
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
    console.error(`error while initializing database`, err);
  });

// NOTE : convert html to snabbdom online to http://html-to-hyperscript.paqmind.com/
// ~~ attributes -> attrs
