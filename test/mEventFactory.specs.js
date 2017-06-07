// mEventFactory(EventFactorySettings, childrenComponents)
// # Test space = Settings x ChildrenComponents
//
// # Testing strategy
// Given the large size (infinite) of the domain of the function under test, the following
// hypothesis based on the knowledge of the implementation (gray-box testing) will be used :
// T1. Testing against A | B is sufficient to guarantee behaviour on A x B (independence of A and B)
// T2. when we have to test against a set of possible values, we will only test the limit
// conditions, assuming that passing those tests implies a correct behaviour for the other
// values.
// T3. When we are confident that a smaller test set is sufficient to imply the expected
// behaviour for the whole set, we will test only against that smaller test.
// T4. In some cases we simply renounce to test against some values of the test space (80-20
// approach). This may happen when the values to be tested against have a sufficient low
// probability of occuring, or an impact that we are willing to absorb.
//
// ## Testing for Settings
// - Settings = BadSettings | GoodSettings (T3 - instead of BadSettings x GoodSettings)
//   - GoodSettings = CustomSettings | DOMSettings | CustomAndDomSettings
//     - CustomSettings = 0 custom | 1 custom | >1 custom (T2)
//     - DOMSettings = 0 DOM | 1 DOM | >1 DOM same event | >1 DOM different events (T2)
//     - CustomAndDomSettings = 1 custom & 1 DOM | >1 custom & >1 DOM (T2)
//       - Note : 1DOM, >1 custom and >1 DOM, 1 custom excluded from the space (T3 - >1 & >1
//   - BadSettings : we only test three conditions (T4):
//     - no events property in settings, custom event factory not a function, selector not a string
//
// implies those cases)
// ## Testing for ChildrenComponents
// - childrenComponents : 0 child | 1 child | > 1 child (T2)
//
// # Test space size
// - |Test Space| = |Settings| x |ChildrenComponents|
//   - |ChildrenComponents| = |0 child| +  |1 child| + |> 1 child| = 3
//   - |Settings| = |BadSettings| + |GoodSettings| (T1 - BadSettings independent from GoodSettings)
//     - |GoodSettings| = |CustomSettings| + |DOMSettings| + |CustomAndDomSettings|
//       - |CustomSettings| = 3
//       - |DOMSettings| = 4
//       - |CustomAndDomSettings| = 2
//       - -> |GoodSettings| = 3 + 4 + 2 = 9
//     - |BadSettings| = 3
// - |Test Space| = |GoodSettings| x |ChildrenComponents| + |BadSettings| (T3, T1 - BadSettings
// independent from ChildrenComponents)
// - |Test Space| = 9 x 3 + 3 = 30
//
// We hence have 30 tests to write, which is still a lot. We could further reduce the number of
// tests by 'diagnoalizing' `Ai x Bj` into `(Ai,Bi)` (testing against A) | (Aj,Bj) (testing
// against `B`) and picking up `Ai, Aj, Bi, Bj` such that `i <> j` implies `Bi <> Bj`.
// This obviously makes sense when one has the confidence that A and B space are
// relatively orthogonal and that the |A| x |B| - (|A| + |B|) untested values have little weight
// (T4, T3). We would then have |Test Space| = 9 + 3 + 3 = 15, i.e. half the number of tests.
//
// We will however choose to go for the previous reduction of the test space to 30. As a matter of
// fact, reducing by half the test space forces to choose well the (Ai) and (Bj), which makes
// the test itself less maintenable - unless the test construction is properly documented.
// We think it is simpler, less error prone, and also more automatizable to do a cartesian
// product of the test subspaces. The hope is we can use some relationship between some `f(ai,bi)`
// so as to deduce some test results from previous test results, possibly reducing the effort by
// more than half.

import * as QUnit from "qunitjs"
import { mEventFactory } from "../src/components/mEventFactory"

const NOT_A_FUNCTION = 42
const NOT_A_STRING = 42


const testSpace = {
  BadSettings: {
    NoEventPropertyInSettings: {
      eventFactorySettings: {
        notEvents: {
          anything: true
        }
      },
      childrenComponents: [] // should not matter
    },
    EventFactoryNotAFunction: {
      eventFactorySettings: {
        events: {
          custom: {
            someEventName: NOT_A_FUNCTION
          }
        }
      },
      childrenComponents: [] // TODO : should not matter but put something there
    },
    SelectorNotAString: {
      events: {
        DOM: {
          someEventName: {
            someSelectorDesc: NOT_A_STRING
          }
        }
      },
      childrenComponents: [] // TODO : should not matter but put something there
    }
  }
}

// Initialization
QUnit.module("Testing mEventFactory(eventFactorySettings, childrenComponents)", {});

//////////////
// BadSettings

// no events property in settings
QUnit.test("Bad settings : no events property in settings", function exec_test(assert) {
  const testData = testSpace.BadSettings.NoEventPropertyInSettings;
  const eventFactoryComponent = mEventFactory(testData.eventFactorySettings, testData.childrenComponents);

  assert.throws(function () {
      eventFactoryComponent({}, {})
    }, /fails/,
    'WHEN called with a settings objects without an event property, it throws')
});

// custom event factory not a function
QUnit.test("Bad settings : custom event factory not a function", function exec_test(assert) {
  const testData = testSpace.BadSettings.EventFactoryNotAFunction;

  const eventFactoryComponent = mEventFactory(testData.eventFactorySettings, testData.childrenComponents);
  eventFactoryComponent({}, {})
  assert.throws(function () {
      eventFactoryComponent({}, {})
    }, /fails/,
    'WHEN called with a settings objects, with an event property and a custom event factory' +
    ' which is not a function, it throws')
});

// selector not a string
