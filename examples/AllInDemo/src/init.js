import { TASKS_INIT_FILTER } from './properties'
import { INITIAL_DATA } from "../fixtures"
import { flatten, keys, map } from "ramda"
import { TASKS_FILTER } from "./inMemoryStore"

export function initRemotelyPersistedState(repository) {
  // in this case, firebase is the repository
  return repository.once('value')
    .then(dataSnapshot => {
      if (keys(dataSnapshot.val()).length === 0) {
        console.log('Firebase database not initialized... Initializing it!')
        return Promise.all(flatten(map(entity => { // for instance, projects
          const entityRef = fbRoot.child(entity);
          return INITIAL_DATA[entity].map(record => {// set in database
            entityRef.push().set(record);
          })
        }, keys(INITIAL_DATA))))
      }
      else {
        console.log('Firebase database already initialized!')
        return Promise.resolve()
      }
    })
}

export function initLocallyPersistedState(repository) {
  // for now there is nothing here
  return true
}

export function initLocalNonPersistedState() {
  return {
    [TASKS_FILTER]: {
      filter: TASKS_INIT_FILTER
    }
  }
}

export function initRepository(firebase) {
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

  return firebase.database().ref();
}
