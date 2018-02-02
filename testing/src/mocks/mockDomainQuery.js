import { F, tryCatch } from "ramda"
import { assertContract } from "../../../contracts/src/index"
import { format } from "../../../debug/src/index"
import { LIVE_QUERY_TOKEN } from "../../../drivers/src/index"

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
  assertContract(isValidDomainQueryMockConfig, [sourceSpecs], `makeDomainQuerySource : Invalid spec for domain query source -- must have one and only one @ character, and both sides around the @ characters must be non-empty! Check ${format(sourceSpecs)}`);
  const [jsonParams, unparsedDomainObject] = sourceSpecs.split('@');
  const { domainObject, isLiveQuery } = parseDomainObject(unparsedDomainObject);

  if (domainObject.length === 0) {
    // empty string cannot be a domain entity moniker
    throw `makeDomainQuerySource: Invalid spec for domain query source -- domain entity cannot be empty string! Check ${format(sourceSpecs)}`
  }

  // Initialize object hash table if not done already
  mockedObj = mockedObj || {};
  mockedObj.hashTable = mockedObj.hashTable || {};
  mockedObj.hashTable[domainObject] = mockedObj.hashTable[domainObject] || {};
  mockedObj.hashTable[domainObject][jsonParams] = mockedObj.hashTable[domainObject][jsonParams] || {};

  if (isLiveQuery) {
    mockedObj.hashTable[domainObject][jsonParams] = stream;
    mockedObj.getCurrent = mockedObj.getCurrent || function (domainObject, params) {
      return mockedObj.hashTable[domainObject][JSON.stringify(params)];
    }
  }
  else {
    mockedObj.hashTable[domainObject][jsonParams] = stream;
    mockedObj.getCurrent = mockedObj.getCurrent || function (domainObject, params) {
      return mockedObj.hashTable[domainObject][JSON.stringify(params)].take(1);
    }
  }

  return mockedObj
}

function parseDomainObject(unparsedDomainObject) {
  return unparsedDomainObject.startsWith(LIVE_QUERY_TOKEN)
    ? {
      domainObject: unparsedDomainObject.split(LIVE_QUERY_TOKEN)[1],
      isLiveQuery: true
    }
    : {
      domainObject: unparsedDomainObject,
      isLiveQuery: false
    }

}

function isValidDomainQueryMockConfig(sourceSpecs) {
  const preParsed = sourceSpecs.split('@');
  const [jsonParams, domainObject] = preParsed;

  return preParsed && preParsed.length === 2 && isValidDomainQuerySourceInput(jsonParams, domainObject)
}

function isValidDomainQuerySourceInput(jsonParams, domainObject) {
  return domainObject && tryCatch(JSON.parse, F)(jsonParams)
  ? true
    : `isValidDomainQuerySourceInput : either domainObject is falsy or jsonParams is invalid JSON!`
}
