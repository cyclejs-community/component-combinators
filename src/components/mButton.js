import { isArrayOf, isBoolean, isOneOf, isOptional, isStrictRecord, isString } from "../utils"
import { m } from "./m"
import { both, complement, either, prop } from "ramda"
import * as Rx from "rx"
import { div } from "cycle-snabbdom"
//TODO: to be tested!!!
let $ = Rx.Observable

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

const checkButtonSettings = both(
  isStrictRecord({
    classes: isOptional(isArrayOf(isString)),
    emphasis: isOptional(isOneOf(['primary', 'secondary', 'positive', 'negative'])),
    basic: isOptional(isBoolean),
    focusable: isOptional(isBoolean),
    animated: isOptional(either(isBoolean, isOneOf(['fade', 'vertical']))),
    label: isOptional(isStrictRecord({ text: isString, position: isOneOf(['left', 'right']) })),
    // we dont check the mapping vs. a registry of possible icons
    icon: isOptional(isString),
    visualState: isOptional(isOneOf(['active', 'disabled', 'loading'])),
    social: isOptional(isOneOf(['facebook', 'twitter', 'google', 'vk', 'linkedin', 'instagram', ' youtube'])),
    size: isOptional(isOneOf(['mini', 'tiny', 'small', 'medium', 'large', 'big', 'huge', 'massive'])),
    shape: isOptional(isOneOf(['circular'])),
    layout: isOptional(isOneOf([
      'attached', 'top attached', 'bottom attached', ' left attached', 'right attached',
      'fluid', 'right floated', 'left floated'
    ])),
    id: isOptional(isString),
    listenTo: isOptional(isOneOf(domEventNames)),
  }),
  // RULE : if there is a `listenTo`, there MUST be an id for the element to listen on
  either(both(prop('listenTo'), prop(id)), complement(prop('listenTo')))
)

function checkButtonPreConditions(sources, settings) {
  return checkButtonSources(sources) && checkButtonSettings(settings)
}

function makeButtonSinks(sources, settings) {
  let attrs = {};
  const buttonClasses = ['ui', 'button'];
  const {
    classes, id, emphasis, basic, focusable, animated, label, icon, visualState, social, size, shape, layout, listenTo
  } = settings;

  if (classes) {
    Array.prototype.push.apply(buttonClasses, classes);
  }

  if (focusable) {
    attrs.tabindex = '0';
  }

  if (emphasis) {
    buttonClasses.push(emphasis);
  }

  if (basic) {
    buttonClasses.push('basic');
  }

  if (animated) {
    // RULE :
    // If a button is animated, it MUST have exactly TWO children components
    // - ONE is visible
    // - ONE is hidden
    // NOTE : The button will be automatically sized according to the visible content size.
    // Make sure there is enough room for the hidden content to show
    isString(animated)
      ? buttonClasses.push('animated', animated)
      : buttonClasses.push('animated');
  }

  if (label) {
    // RULE :
    // A labelled button MUST have ONE child component which is a label
    // AT LEAST ONE child MUST be a button
    // NOTE : we do not follow the react-semantic-ui convention here (for instance `label : {as:
    // 'a', basic:true, pointing : 'left'}`). The label can in any position in the children
    // component, so we cannot insert it ourselves - we cannot where to insert it
    buttonClasses.push('labeled')
  }

  if (icon) {
    // RULE : if a button is an icon button, then it MUST have ONE icon child component (html
    // tag AND class)
    buttonClasses.push('icon')
  }

  if (visualState) {
    buttonClasses.push(visualState)
  }

  if (social) {
    buttonClasses.push(social)
  }

  if (size) {
    buttonClasses.push(size)
  }

  if (layout) {
    // NOTE : I do not really get the semantics of attached...
    // But it seems that `bottom attached` must be the last, and `top attached` the first in a
    // attachement group
    buttonClasses.push(layout)
  }

  if (shape) {
    buttonClasses.push(shape)
  }

  const classObject = reduce((acc, className) => {
    acc[className] = true
    return acc
  }, {}, classes)

  let sinks = {}
  // TODO : change id to selector and remove the #
  if (listenTo && id) {
    sinks = reduce((acc, eventName) => {
      acc[eventName] = sources.DOM.select('#' + id).events(eventName)
    }, {}, listenTo)
  }
  sinks.DOM = $.of(
    div({
      class: classObject,
      attrs: attrs
    })
  )

  return sinks
}

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

/**
 * `mButton` is returning a button component as specified per the `settings` parameter. Note
 * that there is a dependency between the button and its children components in the
 * form of 'grammatical' rules.
 * For instance, an icon button MUST have an icon child component.
 * Such rules would best be enforced at call time by the parent. An option is to introduce the
 * children components in the preconditions contract. Peeking inside a child component type
 * however requires a form of instrospection and that complicates significantly the implementation,
 * so we skip that for now.
 *
 * @param mButtonSettings Settings for the button component. Cf. preconditions contract for the
 * shape of that object (cf. `checkButtonSettings`)
 * @param childrenComponents
 * @returns {Component}
 * @throws throws in case of failing contract
 */
export function mButton(mButtonSettings, childrenComponents) {
  // returns a DOM tree representation with the specifications passed through settings
  // and enclosing the DOM trees returned by the children components
  // Other children sinks are default-merged

  return m(mButtonSpec, mButtonSettings, childrenComponents)
}
