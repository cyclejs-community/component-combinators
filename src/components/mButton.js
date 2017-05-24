import { isStrictRecord, isString, isOptional } from "../utils"
import { m } from "./m"

const mouseEventNames = [
  'mousedown', 'mouseup', 'mouseover', 'mousemove', 'mouseout', 'mouseenter', 'mouseleave',
  'click', 'dblclick',
  'contextmenu'
]
const keyboardEventNames = [
  'keydown', 'keypress', 'keyup'
]
const dragEventNames = [
  'drag', 'dragcenter', 'dragleave', 'drop', 'dragover', 'dragstart', 'dragend',
]
const touchEventNames = [
  'ontouchcancel',
  'ontouchend',
  'ontouchmove',
  'ontouchstart'
]
const nonBubblingEventNames = [
  `blur`, `canplay`, `canplaythrough`, `change`, `durationchange`, `emptied`, `ended`, `focus`,
  `load`, `loadeddata`, `loadedmetadata`, `mouseenter`, `mouseleave`, `pause`, `play`,
  `playing`, `ratechange`, `reset`, `scroll`, `seeked`, `seeking`, `stalled`, `submit`,
  `suspend`, `timeupdate`, `unload`, `volumechange`, `waiting`,
]
const domEventNames = flatten(mouseEventNames, keyboardEventNames, dragEventNames, touchEventNames, nonBubblingEventNames)

function checkButtonSources(sources) {
  return sources && sources.DOM
}

const checkButtonSettings = isStrictRecord({
  /*
   - class
   - emphasis : 'primary, secondary, positive, negative, basic'
   - tabIndex
   - animated : {'', fade, vertical}
   - label : {text, position : 'left, right'}
   - icon : for instance 'cloud' - must be mapped to an actual icon previously
   - visualState : 'active, disabled, loading'
   - social : 'facebook, twitter, google, vk, linkedin, instagram, youtube'
   - size 'mini tiny small medium large big huge massive'
   - layout : 'compact, fluid, attached, top attached, bottom attached, left attached, right attached'
   - listenTo : event list such as click, hover, etc.
   */
  class: isOptional(isString),
  emphasis: isOptional(isOneOf(['primary', 'secondary', 'positive', 'negative', 'basic'])),
  tabIndex: isOptional(isBoolean),
  animated: isOptional(either(isEmpty, isOneOf(['fade', 'vertical']))),
  label: isStrictRecord({ text: isString, position: isOneOf(['left', 'right']) }),
  // we dont check the mapping vs. a registry of possible icons
  icon: isString,
  visualState: isOptional(isOneOf(['active', 'disabled', 'loading'])),
  social: isOptional(isOneOf(['facebook', 'twitter', 'google', 'vk', 'linkedin', 'instagram', ' youtube'])),
  size: isOptional(isOneOf(['mini', 'tiny', 'small', 'medium', 'large', 'big', 'huge', 'massive'])),
  layout: isOptional(isOneOf(['compact', 'fluid', 'attached', 'top attached', 'bottom attached', ' left', 'attached', 'right attached'])),
  listenTo: isOptional(isOneOf(domEventNames)),
})

function checkButtonPreConditions(sources, settings) {
  return checkButtonSources(sources) && checkButtonSettings(settings)
}

// TODO
const mButtonSpec = {
  // No extra sources
  makeLocalSources: null,
  // No extra settings
  makeLocalSettings: null,
  // We check that the settings have the appropriate shape
  checkPreConditions: checkButtonPreConditions,
  checkPostConditions: null,
  // Create the event sinks from the specifications
  makeOwnSinks: makeButtonSinks,
  // We merge children and DOM sinks with the by-default merge functions
  mergeSinks: null
}

// TODO
export function mButton(mButtonSettings, childrenComponents) {
  // returns a DOM tree representation with the specifications passed through settings
  // and enclosing the DOM trees returned by the children components
  // Other children sinks are default-merged

  return m(mButtonSpec, mButtonSettings, childrenComponents)
}
