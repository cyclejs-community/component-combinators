import { assertContract, isArrayOf, isBoolean } from "../../utils"
import { m } from '../m/m'
import { intersection, merge, keys } from 'ramda'
import * as Rx from "rx";
import { isComponent } from "../../components/types"

const $ = Rx.Observable;

function isPipeSettings(sources, settings) {
  if ('overwrite' in settings) {
    return isBoolean(settings.overwrite)
  }
  else {
    return true
  }
}

function isNonEmptyArrayComponent(obj) {
  return obj && obj.length && isArrayOf(isComponent)(obj)
}

function isColliding(sources, sinks) {
  return Boolean(intersection(keys(sources), keys(sinks)).length)
}

function computeSinks(parentComponent, childrenComponents, sources, settings) {
  // NOTE : parentComponent is undefined by construction
  let { overwrite } = settings;

  const acc = childrenComponents.reduce((acc, component) => {
    const sinks = component(acc.sources, acc.settings);

    if ((!overwrite) && isColliding(sources, sinks)) {
      throw `Pipe : Error when merging sinks of component ${component.name} with Pipe sources! A sink may override a source, check source/sink : ${intersection(keys(sources), keys(sinks))}`
    }

    acc.sources = merge(sources, sinks);
    acc.sinks = sinks;

    return acc
  }, { sources, settings, sinks: {} });

  return acc.sinks
}

// Spec
const pipeSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isPipeSettings
};

export function Pipe(pipeSettings, componentArray) {
  assertContract(isPipeSettings, [null, pipeSettings], `Pipe : Pipe combinator may have 'overwrite' settings property. If that is the case, it must be a boolean!`);
  assertContract(isNonEmptyArrayComponent, [componentArray], `Pipe : Pipe combinator must be passed an array of components!`);

  return m(pipeSpec, pipeSettings, componentArray)
}
