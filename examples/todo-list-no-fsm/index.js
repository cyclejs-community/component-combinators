const sinkNames = ['DOM', 'Store', 'auth$']; // TODO : choose all caps or all mins
import {ALL, ACTIVE, COMPLETED, IS_LOGGED_IN} from './properties';
import {UPDATE, DELETE} from '../../src/drivers/store/properties';

App({sinkNames}, [
  OnRoute('/', SwitchCase({
      on: 'auth$'
    }, [
      Case({when: IS_LOGGED_IN}, [
        TodoComponent({routeState: ALL}) // actually will require flip or
        // curry and R.__
      ]),
      Case({when: complement(IS_LOGGED_IN)}, [
        LogIn({redirect: '/'})
      ])
    ]
  )),
  OnRoute('/active', SwitchCase({
      on: 'auth$', sinkNames
    }, [
      Case({when: IS_LOGGED_IN}, [
        TodoComponent({routeState: ACTIVE}) // actually will require flip or
        // curry and R.__
      ]),
      Case({when: complement(IS_LOGGED_IN)}, [
        LogIn({redirect: '/active'})
      ])
    ]
  )),
  OnRoute('/completed', TodoComponent({routeState: COMPLETED})
  )
]);

const TodoComponent = ListManager({
  namespace: 'TODO'
}, ListFactory({
  storeRef: '/'
}, Item));

// TODO : ListManager
// ...
// I am here
// ...
// routeState is in settings
// children DOM to insert in the middle of parent DOM (slot mechanism)
// parent sinks (events, intents, actions) to merge with children sinks
// events : complete all, add new todo, clear completed
// actions : store - update complete all; store : push
// ...
function ListManager(listManagerSettings, component) {
  return function listManagerComponent(sources, componentSettings) {
    let {Store, DOM} = sources;
    let settings = merge(listManagerSettings, componentSettings);
    let {sinkNames, namespace, storeRef} = settings;

    // should have parent dom as Observable<VNode|Array<VNode>|Null>
    // TODO : adjust DOM merge function in consequence
    // Also App component should add a div  to the array if receives one, and
    // filter out null for DOM
    // TODO : slots specs
    // A slot is a VNode which is undefined everywhere except key? or data?
    // hence it has the index of the child to copy there, or a function
    // which takes the number of children and returns an array of those to copy
    function mergeDOMs(parentDOM, childrenDOM, settings) {
      childrenDOM
    }

    function makeListManagerSinks(sources, settings) {

    }

    return m({
      makeOwnSinks: makeListManagerSinks,
      mergeSinks: {
        DOM: mergeDOMs
      }
    }, settings, [component]);

    // TODO : I am here - merge childrenDOM and my DOM

  }
}

//// List
// storeRef : ref where the items will be located
function ListFactory(listSettings, component) {
  return function listFactoryComponent(sources, componentSettings) {
    let {Store, DOM} = sources;
    // TODO : could also keep settings separate instead of propagating downsream
    let settings = merge(listSettings, componentSettings);
    let {namespace, sinkNames, storeRef} = settings;

    // @type Stream<Array<ItemState>>
    let listState$ = Store.in(namespace).get(storeRef);

    // TODO !!!
    //// !! how to use todoItemData -> switch only on delete and insert not UPDATE!!
    return SwitchForEachNew({
      on: listState$, eqFn: onlyDeleteOrInsert, to: 'itemsData', sinkNames
    }, List({
      valueId: 'todoItemData',
      itemId: 'itemRef',
    }, component))
  }
}

// TODO : List combinator implementation, use m? or directly inline it?
// maybe inline it first
function List(listSettings, component) {
  return function ListComponent(sources, componentSettings) {
    let settings = merge(listSettings, componentSettings);
    // beware of namespace problem : value could come from anywhere up
    let {itemsData, valueId, itemId} = settings; // array on which list is based

    // listSinks :: [Sinks], itemsStates :: Array<ItemState>
    let listSinks = itemsData.map((itemData, index) => {
      let componentSettings = merge(
        settings,
        {[itemId]: index},
        {[valueId]: itemData}
      );
      return component(sources, componentSettings)
    });

    // This following merge should be the default merge in utils
    const sinkNames = getSinkNames(listSinks);
    // Every sink but DOM
    let finalSinks = sinkNames.reduce((finalSinks, sinkName) => {
      finalSinks[sinkName] = $.merge(listSinks.map(sinks => sinks[sinkName]));
      return finalSinks
    }, {});
    // TODO : Add DOM treatment $.merge => $.combineLatest(Array Obs
    // VNode, div)
    // TODO : not div, discriminate case of array of size 0 or 1 or 2+

    return finalSinks
  }
}

//// Item
// itemRef = storeRef + index item, passed by ListFactory parent
// in Store : {completed: Boolean, text : String}
function Item(sources, settings) {
  let {Store, DOM} = sources;
  let {namespace, itemRef, todoItemData} = settings;
  // Note : todoItemData is not used here as it already fethced with state$
  let state$ = Store.in(namespace).get(itemRef);

  // TODO : replace events and selectors by actual values from view template
  let events = {
    'dbl_click': DOM.select('input area').events('double-click'),
    'radio_click': DOM.select('radio button').events('click'),
    'enter_keypress': DOM.select('input area').events('enter keypress'),
    'delete': DOM.select('cross').events('click'),
  };
  let intents = {
    'edit_item': events.dbl_click.map(_ => true),
    'toggle_completed': events.radio_click.map(ev => TODO), // TODO
    'update_item_text': events.enter_keypress.flatMap(ev => TODO), // TODO
    'delete_item': events.delete.map(_ => ({itemRef}))
  };
  let actions = {
    DOM: state$.combineLatest(intents.edit_item, combineFn).map(view), // TODO
    Store: {
      'toggle_completed': intents.toggle_completed.map(val => ({
        command: UPDATE,
        ref: itemRef,
        payload: {completed: val},
      })),
      'update_item_text': intents.update_item_text.map(text => ({
        command: UPDATE,
        ref: itemRef,
        payload: {text: text}
      })),
      'delete_item': intents.delete.map(itemRef => ({
        command: DELETE,
        ref: itemRef,
        payload: {}
      }))
    }
  };

  return {
    DOM: actions.DOM,
    Store: merge(
      actions.toggle_completed,
      actions.update_item_text,
      actions.delete_item
    )
  }
}

// TODO : other version with mergeAll and takeUntil to dynamically manage
// insertion and deletiong
