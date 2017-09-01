import { Observable as $ } from "rx"
import { tryCatch } from 'ramda';

// Helper functions
function errorHandler(e, repository, params) {
  void repository;

  console.error('makeDomainQueryDriver: an error occured', e);
  console.warn('extra info: params', params);

  return Promise.reject(e);
}

/**
 * Driver factory which takes a configuration object and returns a driver.
 * This drivers runs live query on a repository fetching data about bounded contexts.
 * The configuration object maps a context to a function which receives a query and
 * returns a stream of data matching that query.
 * @param repository
 * @param config
 * @returns
 */
export function makeDomainQueryDriver(repository, config) {
  return function (sink) {
    // not used, this is a read-only driver
    void sink;

    return {
      query: function query(domainObject, params) {
        const fnToExec = config[domainObject].get;
        const wrappedFn = tryCatch(fnToExec, errorHandler);

        // NOTE : This will recompute the `get` for every call, we don't use caching here
        // and we should not : there is no reason why the same call should return the same value!
        // If this should be implementing a live query, then we should cache not to recompute
        // the live query. The live query automatically pushes updates
        return $.fromPromise(wrappedFn(repository, params));
      }
    }
  }
}
