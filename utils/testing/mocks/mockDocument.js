/**
 *
 * @param _mockedObj
 * @param sourceSpecs Has shape `property@selector`
 * @param stream
 * @returns {*|{}}
 */
export function makeMockDocumentSource(_mockedObj, sourceSpecs, stream) {
  // property is 'value' by default, from `document.querySelector(selector).value`
  // selector is the `selector` in `document.querySelector(selector)`
  const [property, selector] = sourceSpecs.split('@');

  if (!isValidDocumentSourceInput(property, selector)) {
    throw `Invalid spec for document source : ${sourceSpecs}`
  }

  // Initialize object hash table if not done already
  let mockedObj = _mockedObj || {};
  mockedObj.hashTable = mockedObj.hashTable || {};
  mockedObj.hashTable[selector] = mockedObj.hashTable[selector] || {};
  mockedObj.hashTable[selector][property] = mockedObj.hashTable[selector][property] || {};

  // register the stream in the hash table
  // mockedObj.hashTable[selector][property] = { stream, value: undefined };
  // stream data updates property
  stream.subscribe(function updateProperty(val) {
      mockedObj.hashTable[selector][property] = val;
    }
  );

  // build the mock anew to incorporate the new stream
  mockedObj.querySelector = function querySelector(selector) {
    return mockedObj.hashTable[selector]
  }

  return mockedObj
}

function isValidDocumentSourceInput(property, selector) {
  // Keep it simple for now
  return !!property && !!selector
}
