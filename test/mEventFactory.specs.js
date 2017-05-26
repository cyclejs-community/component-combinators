// mEventFactory(EventFactorySettings, childrenComponents)
// Settings x ChildrenComponents
// Settings = badSettings | goodSettings
// goodSettings : customSettings | DOMSettings | customAndDomSettings
// customSettings : 0 custom | 1 custom | >1 custom
// DOMSettings  : 0 DOM | 1 DOM | >1 DOM same event | >1 DOM different events
// customAndDomSettings : 1 custom & 1 DOM | >1 custom & >1 DOM
// childrenComponents : 0 child | 1 child | > 1 child
// grey-testing restrictions :
// card (>1) = 1, i.e. we only test with 2
//
// card (Settings x ChildrenComponents) = card (Settings) x card (ChildrenComponents)
// card (ChildrenComponents) = card (0 child) +  card(1 child) + card( > 1 child) = 3
// card (Settings) = card(badSettings) + card (goodSettings)
// card (goodSettings) = card(customSettings) + card(DOMSettings) + card(customAndDomSettings)
// card(customSettings) = 3
// card(DOMSettings) = 4
// card(customAndDomSettings) = 2
// card (goodSettings) = 3 + 4 + 2 = 9
// grey-testing restrictions :
// we test badSettings independently
// card (Settings x ChildrenComponents) = card (goodSettings) x card (ChildrenComponents) +
// card(badSettings)
// card (Settings x ChildrenComponents) = 9 x 3 + card(badSettings)
// grey-testing restrictions :
// we only test three conditions
// no events property in settings, event factory not a function, selector not a string,
// card (badSettings) = 3
//
// card (Settings x ChildrenComponents) = 9 x 3 + 3
// card (Settings x ChildrenComponents) = 30 tests!!!!!!
// still a lot. We should be able to copy paste the test. Event better if we could compose them...
// TODO : think, do we have an algebra? a monoid? how do we compose fn to test and results?
// manually maybe is the best and see if there is a pattern emerging
