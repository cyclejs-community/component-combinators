import { m } from '../m/m'
import { combinatorNameInSettings } from "../../../tracing/src/helpers"
import { set } from 'ramda'

// Spec
// Yes, there is nothing, default behaviour of `m` is what we want
const combineSpec = {};

export function Combine(combineSettings, componentTree) {
  return m(combineSpec, set(combinatorNameInSettings, 'Combine', combineSettings), componentTree)
}
