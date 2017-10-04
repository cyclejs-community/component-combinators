import { assertContract } from "../../utils"
import { fromPairs, keys, merge, mergeAll, values } from 'ramda'

// TODO : change InjectSources -> InjectStateInSources, and do the shareReplay automatically
// so go through the code and remove the shareReplay I have added...

function isInjectStateInSinksSettings(settings) {
  const _keys = keys(settings);

  return _keys.length === 0
    ? false
    : _keys.every(sourceName => {
      const setting = settings[sourceName];

      return 'as' in setting
        && 'inject' in setting
    })
}

/**
 *
 * @param {Object.<string, {as: string, inject:Array.<Object.<string, string>>}>} injectSettings
 * The keys of `injectSettings` are the sink names of the component to be intervened. The
 * corresponding sink emitted values will be replaced by an object which contains that emitted
 * value (under the property configured in `as`), and also the values emitted by the
 * injected sources configured in `inject`.
 * `inject` configuration is a mapping between source names and the property holding the emitted
 * value by the corresponding source.
 * For instance,
 * sinks= {a$, b$}, sources= {s1$, s2$}, InjectStateInSinks({a$: {as: 'a', inject: {'s1$' : 's1'}}})
 * if sinks.a$ emits A, s1$ holds S1 at the time of this emission, then InjectStateInSinks sinks are
 * {a'$, b$} where a'$ emits {a: 'A', s1: S1}, and b$ is not intervened, i.e. emits smae as usual
 * Contract:
 * - sources to inject must be BEHAVIOURS, i.e. they must always hold a value
 * @param {Component} component
 * @returns {Component}
 * @constructor
 */
export function InjectStateInSinks(injectSettings, component) {
  assertContract(isInjectStateInSinksSettings, [injectSettings], `properties 'as' and 'inject' are mandatory!`);

  return function InjectStateInSinks(sources, settings) {
    let sinks = component(sources, settings);
    const sinksToInject = keys(injectSettings);

    const injectedSinks = sinksToInject.map(sinkToInject => {
      const { as, inject } = injectSettings[sinkToInject];
      const behavioursNames = keys(inject);
      const behaviours = behavioursNames.map(x => sources[x]);
      const behavioursNameTranslations = values(inject);

      return {
        [sinkToInject]: sinks[sinkToInject].withLatestFrom(...behaviours, function (sinkValue,
                                                                                    ...behavioursValue) {
          const behavioursSinks = fromPairs(behavioursNameTranslations.map((behaviourNameTranslation,
                                                                            index) => {
            return [behaviourNameTranslation, behavioursValue[index]]
          }));

          return merge({ [as]: sinkValue }, behavioursSinks)
        })
      }
    });

    return merge(sinks, mergeAll(injectedSinks))
  }
}
