// ForEach({from : 'fetchedCardsInfo$', as : 'items'}

//////
// Helper functions
function hasAtLeastOneChildComponent(childrenComponents) {
  return childrenComponents &&
  isArray(childrenComponents) &&
  childrenComponents.length >= 1 ? true : ''
}

function isForEachSettings (sources, settings) {
  return 'from' in settings && 'as' in settings
  && isString(settings.from) && isString(settings.as)
}

// Spec
const ForEachSpec = {

};

// TODO : later, first chan
export function ForEach(forEachSettings, childrenComponents) {
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `ForEach : ForEach combinator must at least have one child component to switch to!`);
  assertContract(isForEachSettings, [null, forEachSettings], `ForEach : ForEach combinator must have 'from' and 'as' property which are strings!`);

  return m(ForEachSpec, forEachSettings, childrenComponents)
}
