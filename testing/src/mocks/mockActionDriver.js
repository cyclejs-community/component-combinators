/**
 * NOTE: It is necessary to mock `getResponse` method of `ActionDriver`
 * This allows among other things to simulate, without incurring in any effects, live queries
 * obtained by concatenating current value and future value updates. For instance :
 * function fetchPageNumber(sources, settings) {
 *   return sources.domainQuery.getCurrent(_index2.PAGE)
 *   // NOTE : building a live query by fetching the current page number and adding page number
 *   // change notifications resulting from actions affecting the page
 *   .concat(sources.domainAction$.getResponse(_index2.PAGE).map((0, _ramda.path)(['response',
  *   'page'])))
 *   .shareReplay(1)
 * }
 */

// TODO test it in next version?

/**
 *
 * @param mockedObj
 * @param sourceSpecs Has shape jsonStringifyParams@domainObject. It is very important that the
 * left side of `sourceSpecs` be a string returned by applying JSON.stringify to the mocked
 * args. If there is even a blank space of difference, the mocking function might fail its lookup
 * @param stream
 * @returns {*|{}}
 */
export function makeDomainActionSource(mockedObj, sourceSpecs, stream) {
  const domainObject = sourceSpecs;

  if (!isValidContext(domainObject)) {
    throw `Invalid context for domain action source : ${domainObject}`
  }

  // Initialize object hash table if not done already
  mockedObj = mockedObj || {};
  mockedObj.hashTable = mockedObj.hashTable || {};
  mockedObj.hashTable[domainObject] = mockedObj.hashTable[domainObject] || {};
  mockedObj.hashTable[domainObject] = stream;
  // build the mock anew to incorporate the new stream
  mockedObj.getResponse = function (domainObject) {
    return mockedObj.hashTable[domainObject];
  }

  return mockedObj
}

function isValidContext(domainObject) {
  // NOTE : ideally we would check that the context actually exists, but we have no way to do
  // this, out of a prior registry of contexts... Passing mispelled entities could then become a
  // source of writing tests wrong. This can be alleviated by systematically using enum aliases,
  // or predefined constants to hold entity's name.
  return !!domainObject
}
