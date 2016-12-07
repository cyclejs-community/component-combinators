# Examples
## TODO list app
### Functional specifications
- three routes : active todos, completed todos, all todos
- one field `what needs to be done?` to enter new todo
- list of entered todos
- for each entered todos, delete button, completed radio, text input with 
todo description
- one label with `x` items left
- three labels `All`, `Active`, `Completed` being emphasized according to route
- authentication required to view active or all route
- no authentication required to view completed route
### Technical specifications
#### Data structures
TodoList :: [TodoItem]
TodoItem :: {active : Boolean, description : String}
AppState :: TodoList
#### Drivers
- auth$ : returns true or false if the user is logged in or not respectively
- route$ : navigates to a given route, emit new route events
- DOM
- Store
#### Constants and properties
- IS_LOGGED_IN
- ALL
- ACTIVE
- COMPLETED
#### Components
- LogIn : display a dummy message, one button which logs in and reroutes
### Implementation through combinators
const sinks = [TODO]
App({sinks : sinks}, [
  OnRoute('/', SwitchCase({
      on : 'auth$'
    }, [
      Case({when: IS_LOGGED_IN}, [
        TodoComponent({routeState : ALL}) // actually will require flip or 
        // curry and R.__
      ]),
      Case({when: complement(IS_LOGGED_IN}, [
        LogIn({redirect: '/'})
      ])
    ]
  )),
  OnRoute('/active', SwitchCase({
      on : 'auth$', sinks : sinks
    }, [
      Case({when: IS_LOGGED_IN}, [
        TodoComponent({routeState : ACTIVE}) // actually will require flip or 
        // curry and R.__
      ]),
      Case({when: complement(IS_LOGGED_IN}, [
        LogIn({redirect: '/active'})
      ])
    ]
  )),
  OnRoute('/completed', TodoComponent({routeState: COMPLETED})
  )
])
TodoComponent=curry(flip(
  StateChart({
    sinks : [sinkNames],
    namespace : some UNIQUE (vs. action requests) identifier for the statechart, // Ex: TODO_SC
    // changed -> to compute x items left, removed -> to compute x items left
    intents : {ADD_ITEM, COMPLETE_ALL, CHILD_CHANGED, CHILD_REMOVED},
    actions : [ADD_ITEM, COMPLETE_ALL],
    responses : ['Store']
    model$ : {Store.get(namespace)(null), showOnlyActive : settings.routeState},
    transitions : [
      INIT -> INIT -> ERROR: ?? -> NO GUARD -> ENTRY :
        (event, model$) => {
          // Can have action requests with/out a response if FSM does not care
          // Can be DOM updates, route changes for example, but not ADD_ITEM
          SwitchForEach(model$, List (prepare(model), TodoItemComponent))
        },
      INIT -> SUCCESS:INIT -> ERROR: ?? -> NO GUARD -> ADD_ITEM : 
        (event, model$) => {
          {Store: $.of({command: ADD_TODO, namespace, ref, payload: todoText})},
          // If one wants optimistic update, can also add:
          {DOM : model$.map(ADD_ITEM_model_update).map(view)}
        },
      INIT -> SUCCESS:INIT -> ERROR: ?? -> NO GUARD -> COMPLETE_ALL :
        (event, model$) => {Store: model$.map(childIndex => {
          namespace,
          reference: childRef(childIndex, parentRef),
          command: UPDATE, 
          payload: refValue => setCompleted(refValue)
          // setCompleted = refValue => (refValue.completed = true, refValue)
        })},
      ADD_ITEM_ERROR -> ??? -> ERROR: ?? -> NO_GUARD -> AUTO :
        // could do multiple retry through this mechanism
    ],
    })
))
TodoItemComponent = (sources, settings) => {
  index, namespace, parentRef, ... <- settings
  events <- {dom.select... etc}
  intents <- makeIntents(events)
  itemState$ <- makeItemState(sources, intents)
  makeItemState : (sources, intents) => ...scan(..).startWith(...)
  {
    DOM : itemView(itemState$),
    Store : merge([
      intents.deleteIntent$.map({
        command: DELETE, namespace, ref:'parentRef/index', payload: {}
      }),
      intents.markAsCompleted$.map({
        command: UPDATE, namespace, ref:'parentRef/index', payload: 
        {completed: true}
      })
    ])
  }
}

- Parent hold reactive COPY (i.e. property) of the state of their children
  - Store.get(namespace, reference)
    - reference is the root level so all children changes are propagated
    - similar to firebase (CHECK)
- ADD CHILD event : 
  - modify parent state to add a new childState to [childState]
    - SUCCESS : recompute sources = f (sources, parentState$)
      - parentState has [childState]
      - List({initChildStates, parentScope}, Item)
    - FAILURE : TO DO
- On STORE CHANGE event:
  - get the index of child(ren) who has/have changed
  - if the change is a deletion, recompute sources
  - else do nothing
  - hence communication children -> parent is coordinated through STORE
    - communication parent -> children is done through updating children 
    settings. This involves recomputing the children - or using an observable
     passed through settings

- Child has a DELETE event
  - associated action is to update child state to null
  - 

- Store has following behaviour
  - takes listener for changes
  - listener can listen for changes on a specific path
  - changes happening at a specific path are also emitted to listener at a 
  higher level
    - in that case, the reference(s) of the changes are also sent
  - similar to firebase
  - hence event change is both a property (new current state) and an event
  (state change)... 
    - Is it sound to conflate the two?? Be careful to multicast by default in
     that case : will have subscription for property + subscription for event

----------
second option, no statechart, just Store
TodoComponent = ListManager({
  namespace: 'TODO',
  sinkNames : [...]
}, ListFactory({
     storeRef : '/'
   }, Item))

// TODO : ListManager
// ...
// I am here
// ...
// children DOM to insert in the middle of parent DOM (slot mechanism)
// parent sinks (events, intents, actions) to merge with children sinks
// events : complete all, add new todo
// actions : store - update complete all; store : push
// ...


//// List
// storeRef : ref where the items will be located
ListFactory (listSettings, component)(sources, settings) {
  let {Store, DOM} = sources
  settings <- merge(settings, listSettings)
  let {namespace, sinkNames, storeRef} = settings
  
  let listState$ = Store.in(namespace).get(storeRef)
  
  return SwitchForEach({on: listState$}, List({
    valueId: 'todoItem',
    itemId: 'itemRef',
  }, component))
  // TODO : I am here
  List (listSettings, component) (sources, settings) {
    settings <- merge(settings, listSettings)
    // beware of namespace problem : value could come from anywhere up
    let {matched, valueId, itemId} = settings // array on which the list is based

    // listSinks :: [Sinks]
    let listSinks = matched.map((data, index) => {
      let componentSettings = merge(
        settings, 
        {[itemId] : index},
        {[valueId]: data}
      )
      return component(sources, componentSettings)
    })
    
    // This following merge should be the default merge in utils
    const sinkNames = getSinkNames(listSinks)
    // Every sink but DOM
    let finalSinks = sinkNames.reduce((finalSinks, sinkName) => {
      finalSinks[sinkName] = $.merge(listSinks.map(sinks => sinks[sinkName]))
      return finalSinks
    }, {})
    // TODO : Add DOM treatment $.merge => $.combineLatest(Array Obs VNode, div)
    // TODO : not div, discriminate case of array of size 0 or 1 or 2+
    
    return finalSinks
  }
}

//// Item
// itemRef = storeRef + index item, passed by ListFactory parent
// in Store : {completed: Boolean, text : String}
Item (sources, settings) {
  let {Store, DOM} = sources
  let {namespace, itemRef, sinkNames} = settings

  let state$ = Store.in(namespace).get(itemRef)
  let events = {
    'dbl-click': DOM.select(double-click, input area),
    'radio-click': DOM.select(click, radio button),
    'enter-keypress': DOM.select(enter keypress, input area),
    'delete': DOM.select(click, cross div),
  }
  let intents = {
    'edit-item': events.dbl-click.map(_ => true)),
    'toggle-completed': events.radio-click.map(ev => ...)
    'update-item-text': events.enter-keypress.flatMap(ev => DOM....)
    'delete': events.delete.map(_ => {itemRef})
  }
  let actions = {
    DOM : state$.combineLatest(intents.edit-item, ...).map(view),
    Store: {
      'toggle-completed' : intents.toggle-completed.map(val => {
        command : UPDATE,
        ref: itemRef,
        payload : {completed: val},
      }),
      'update-item-text': intents.update-item-text.map(text => {
        command : UPDATE,
        ref: itemRef,
        payload : {text: text}
      }),
      'delete' : intents.delete.map(itemRef => {
        command : DELETE,
        ref: itemRef,
        payload: {}
      })
    }
  }
  
  return {
    DOM : actions.DOM,
    Store : merge(
      actions.toggle-completed, 
      actions.update-item-text,
      actions.delete
    )
  }
}
