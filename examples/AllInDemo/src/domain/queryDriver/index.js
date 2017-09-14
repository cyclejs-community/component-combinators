import { Observable as $ } from "rx"
import { complement, isNil, tryCatch } from 'ramda';
import { assertContract, isFunction, isObservable, isPromise } from "../../../../../src/utils"

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
      getCurrent: function query(context, payload) {
        assertContract(complement(isNil), [config[context]],
          `makeDomainQueryDriver > getCurrent : Context ${context} not found in config object!`);
        assertContract(isFunction, [config[context].get],
          `makeDomainQueryDriver > getCurrent : Context ${context} has a get property which is not a function!`);

        const fnToExec = config[context].get;
        const wrappedFn = tryCatch(fnToExec, errorHandler);

        // NOTE : This will recompute the `get` for every call, we don't use caching here
        // and we should not : there is no reason why the same call should return the same value!
        // If this should be implementing a live query, then we should cache not to recompute
        // the live query. The live query already automatically pushes updates
        const output = wrappedFn(repository, context, payload);
        return isPromise(output)
          ? $.fromPromise(output)
          : isObservable(output) ? output : $.of(output)
      }
    }
  }
}
