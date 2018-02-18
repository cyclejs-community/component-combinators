import { m } from '../m/m'

// Spec
// Yes, there is nothing, default behaviour of `m` is what we want
const combineSpec = {};

export function Combine(combineSettings, componentTree) {
  return m(combineSpec, combineSettings, componentTree)
}
