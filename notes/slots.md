mergeDOMbySlots (parentDomSink, childrenDomSinks, settings) {
  // @type {Array<String>} slots
  const {slots} = settings;
  
  // deal with null sinks etc.
  $.combineLatest(flatten(parentDomSink, childrenDomSinks))
    .map(vNodeTreeArray => {
      // reorder according to slots (use ramda sort)
      return sortBy (vTree => getSlotIndex(getSlot(vTree), slots), vTreeArray)
    })
    .map(div) // unless only one
}


put the slots in the settings of the child component

# Example
```
m({}, {}, [
  Navigation({slots : ['', 'navigation-section']}, [Header, [
    SomeContent,
    InSlot({slot : ''navigation-section'}, [NavigationSection()],
    InSlot({slot : ''navigation-section'}, [NavigationSection()],
    OtherContent
  ]])
])
```

# InSlot
`InSlot` set the `vNode.data.slot` property to `settings.slot`
`InSlot` should not pass its settings!, at least not its slot settings

# getSlot :: vTree -> String
`return vNodeTree.data.slot`
or someting like that, must return undefined is no slot set up

# getSlotIndex :: String -> Slots -> Number
- `Slots :: Array<String>`

function getSlotIndex(slotToFind, slots){
  return findIndex(equals(slotToFind || undefined), slots)
}

