import { tryCatch, F } from "ramda"

/**
 *
 * @param mockedObj
 * @param sourceSpecs Has shape jsonStringifyParams@domainObject. It is very important that the
 * left side of `sourceSpecs` be a string returned by applying JSON.stringify to the mocked
 * args. If there is even a blank space of difference, the mocking function might fail its lookup
 * @param stream
 * @returns {*|{}}
 */
export function makeDomainQuerySource(mockedObj, sourceSpecs, stream) {
  const [jsonParams, domainObject] = sourceSpecs.split('@');

  if (!isValidDomainQuerySourceInput(jsonParams, domainObject)) {
    throw `Invalid spec for domain query source : ${sourceSpecs}`
  }

  // Initialize object hash table if not done already
  mockedObj = mockedObj || {};
  mockedObj.hashTable = mockedObj.hashTable || {};
  mockedObj.hashTable[domainObject] = mockedObj.hashTable[domainObject] || {};
  mockedObj.hashTable[domainObject][jsonParams] = mockedObj.hashTable[domainObject][jsonParams] || {};
  // register the stream in the hash table
  mockedObj.hashTable[domainObject][jsonParams] = stream;
  // build the mock anew to incorporate the new stream
  mockedObj.getCurrent = function (domainObject, params){
    return mockedObj.hashTable[domainObject][JSON.stringify(params)];
  }

  return mockedObj
}

function isValidDomainQuerySourceInput(jsonParams, domainObject) {
  return domainObject && tryCatch(JSON.parse, F)(jsonParams)
}
