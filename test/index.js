window.$ = window.jQuery = require('jquery');

import './m.specs'
import './FSM.specs'
import './utils.specs'
//import './mEventFactory.specs' // TODO that is a case apart, no need for children sinks here!!
import './mButton.specs' // DOC case apart : MUST NOT have parent sinks, only children sinks
import './runTestScenario.specs'
import './Switch.specs' // TODO DOC I could have a parent with switch too, try it
import './Router.specs' // TODO DOC I could have a parent with router too, try it
import './ForEach.specs' // TODO DOC I could have a parent with ForEach too, try it
import './ListOf.specs'
