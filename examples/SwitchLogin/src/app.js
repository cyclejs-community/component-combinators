import { IS_LOGGED_IN, IS_NOT_LOGGED_IN } from "./properties"
import { Case, Switch } from "../../../src/components/Switch/Switch"
import { MainPage } from "./MainPage"
import { LoginPage } from "./LoginPage"
import { DOM_SINK, decorateWithOne } from "@rxcc/utils"
import {
  getFunctionName, makeFunctionDecorator
} from "main/WebstormProjects/component-combinators/utils/src"
import {assoc, curry} from 'ramda'

export const App = Switch({
  on: convertAuthToIsLoggedIn,
  sinkNames: ['auth$', DOM_SINK, 'router'],
  as: 'switchedOn',
  trace: 'Switch'
}, [
  Case({ when: IS_NOT_LOGGED_IN, trace: 'LoginPage Case' }, [
    LoginPage({ redirect: '/component-combinators/examples/SwitchLogin/index.html?_ijt=7a193qn02ufeu5it8ofa231v7e' })
  ]),
  Case({ when: IS_LOGGED_IN, trace: 'MainPage Case' }, [
    MainPage
  ]),
]);

function convertAuthToIsLoggedIn(sources, settings) {
  // NOTE : auth$ contains the authenticated user, we only need to know whether that user is
  // logged in or not
  return sources.auth$
    .map(auth => auth ? IS_LOGGED_IN : IS_NOT_LOGGED_IN)
    .tap(x => console.warn('convertAuthToIsLoggedIn > sources.auth$', x))
    // NOTE : big big bug if I don't share replay here...
    .shareReplay(1)
}

// TODO DOC when using sources.source it must be sharedReplayed to avoid going back again to
// producing the value... NOT shared because they will connect at different moment?? dont now
// but does not work

/**
 * @typedef {{before:Function, after:Function, afterThrowing:Function, afterReturning:Function, around:Function}} Advice
 */
const decorateWithAdvice = curry(_decorateWithAdvice);

/**
 *
 * @param {Array<Advice>} advices
 * @param {Function} fnToAdvise
 * @returns {Function} function decorated with the advices
 */
function _decorateWithAdvice(advices, fnToAdvise) {
  return advices.reduce((acc, advice) => {
    return decorateWithOneAdvice(advice, acc)
  }, fnToAdvise)
}

function decorateWithOneAdvice(advice, fnToAdvise) {
  const fnToDecorateName = getFunctionName(fnToAdvise);

  return NamedFunction(fnToDecorateName, [], `
      const args = [].slice.call(arguments);
      const decoratingFn = makeAdvisedFunction(advice);
      const joinpoint = {args, fnToDecorateName};
      return decoratingFn(joinpoint, fnToAdvise);
`,
    { makeAdvisedFunction, advice, fnToAdvise, fnToDecorateName });
}

function makeAdvisedFunction(advice) {
  // Contract :
  // if `around` is correctly set, then there MUST NOT be a `before` and `after`
  // if `around` is not set, there MUST be EITHER `before` OR `after`
  if ('around' in advice && typeof(advice.around)==='function') {
    if ('before' in advice || 'after' in advice) {
      throw `makeAdvisedFunction: if 'around' is set, then there MUST NOT be a 'before' or 'after' property`
    }
    else {
      // Main case : AROUND advice
      return function aroundAdvisedFunction(joinpoint, fnToDecorate) {
        // NOTE : could be shorten, but left as is for readability
        return advice.around(joinpoint, fnToDecorate)
      }
    }
  }
  else if (!('before' in advice || 'after' in advice)) {
    throw `makeAdvisedFunction: if 'around' is not set, then there MUST be EITHER 'before' OR 'after' property`
  }
  else {
    // Main case : BEFORE or/and AFTER advice
    return function advisedFunction(joinpoint, fnToDecorate) {
      const {args, fnToDecorateName} = joinpoint;
      const { before, after, afterThrowing, afterReturning, around } = advice;

      before && before(joinpoint, fnToDecorate);
      let result;
      let exception;

      try {
        result = fnToDecorate.apply(null, args);

        // if advised function does not throw, then we execute `afterReturning` advice
        // TODO : Contract : if `after` then MUST NOT have `afterThrowing` or `afterReturning`
        afterReturning && afterReturning(assoc('returnedValue', result, joinpoint), fnToDecorate);
        return result
      }
      catch (_exception) {
        // Include the exception information in the joinpoint
        afterThrowing && afterThrowing(assoc('exception', _exception, joinpoint), fnToDecorate);
        exception = _exception;
        throw _exception
      }
      finally {
        // We execute `after` advice even if advised function throws
        after && after(merge({returnedValue: result, exception}, joinpoint), fnToDecorate);
      }
    };
  }
}
