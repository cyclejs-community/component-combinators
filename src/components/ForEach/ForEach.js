// ForEach({from : 'fetchedCardsInfo$', as : 'items'}

//////
// Helper functions
function hasAtLeastOneChildComponent(childrenComponents) {
  return childrenComponents &&
  isArray(childrenComponents) &&
  childrenComponents.length >= 1 ? true : ''
}

// TODO : later, first chan
export function ForEach(forEachSettings, childrenComponents) {
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `ForEach : ForEach combinator must at least have one child component to switch to!`);
  assertContract(isForEachSettings, [null, forEachSettings], `ForEach : switch combinator must at least have one child component to switch to!`);
  let _SwitchSpec = SwitchSpec;
  let _switchSettings = switchSettings;

  // if we precompute the switch source, then change the specs and settings of the case
  // components so that we add the precomputed source to the children sources, and we pass the
  // `on` settings to be that extra source.
  // All this is to avoid a previous bug where the computed switch source was computed within
  // the Case component, hence it was computed every time for every case component
  if (isFunction(switchSettings.on)) {
    _SwitchSpec = assoc('makeLocalSources', function addComputedSwitchSource(sources, settings) {
      const switchSource = switchSettings.on(sources, settings);
      return {
        [SWITCH_SOURCE]: switchSource
      }
    }, SwitchSpec);
    _switchSettings = assoc('on', SWITCH_SOURCE, switchSettings);
  }

  return m(_SwitchSpec, _switchSettings, childrenComponents)
}
