# Frontend
App = m({}, {sinkNames:..., routeSource:...}, UI)

UI = \[[SidePanel](.SidePanel.md), [MainPanel](.MainPanel.md)\]

### Nav
only sets enclosing <nav> tags
### Section, SubSection
- settings : 
  - title
    - a priori used by the parent component, should be displayed proeminently, ahead of subsections and other children
  - link
    - clicking on the div should route to the location in `link`

# Advantages
- you can go top down
  - take a ui
  - break it down into components
  - write the structure first
  - then fill in the blank in the order that you want
    - first dummy html
    - then real html constructed from inputs
    - then add events
    - then add actions and services
  - this allows for progressive testing

Resistance to changes or maintanability :
- if the ui changes, it is easy to find where to apply changes, as the component tree follows the UI.
- if the model changes, it is a bit more annoying, but disciplined use of Inject can help finding out the component affected by the model change (the famous slicing problem)
- if the action changes, that is a bit more easy, it is about getting maybe different inputs (Inject!) and changing the reactive funcion (action = f(event))

There can still be significant changes in implementation from changes in UI/model/functionality, however hopefully the impact on the implementation is easier to identify, and only a specific slice has to change.

# Organization
Find a way to organize all the information. When the tree gets deep, one loose navigation ability, which is the key really to readability, which is a problem with angular (going back and forth between component and diretives, and js, and html, etc.)
