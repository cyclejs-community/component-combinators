import * as QUnit from 'qunitjs';
QUnit.dump.maxDepth = 200;
window.$ = window.jQuery = require('jquery');

// import './m.specs'
// import './FSM.specs'
// import './utils.specs'
// import './mEventFactory.specs'
// import './mButton.specs'
// import './runTestScenario.specs'
// import './Switch.specs'
// import './Router.specs'
// import './ForEach.specs'
// import './ListOf.specs'
// import './Pipe.specs'
// import './mockDomainQuery.specs'
// import './trace.specs'
// import './trace.switch.specs' // BIG file
// import './trace.router.specs'
import './trace.inject.cycle.specs'
