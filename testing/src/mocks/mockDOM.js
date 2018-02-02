function isValidDOMSourceInput(select, event) {
  // Keep it simple for now
  return !!select && !!event
}

function makeDOMMock(hashTable) {
  return function mockCycleDOMSelect(selector) {
    return {
      events: function mockCycleDOMEvent(event) {
        return hashTable[selector][event]
      }
    }
  }
}

function makeMockDOMSource(mockedObj, sourceSpecs, stream) {
  const [select, event] = sourceSpecs.split('@');

  if (!isValidDOMSourceInput(select, event)) {
    throw `Invalid spec for DOM source : ${sourceSpecs}`
  }

  // Initialize object hash table if not done already
  mockedObj = mockedObj || {};
  mockedObj.hashTable = mockedObj.hashTable || {};
  mockedObj.hashTable[select] = mockedObj.hashTable[select] || {};
  mockedObj.hashTable[select][event] = mockedObj.hashTable[select][event] || {};
  // register the stream in the hash table
  mockedObj.hashTable[select][event] = stream;
  // build the mock anew to incorporate the new stream
  mockedObj.select = makeDOMMock(mockedObj.hashTable)
  return mockedObj
}

export {
  makeMockDOMSource
}
