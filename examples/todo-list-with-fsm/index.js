const sinks = ['DOM', 'Store', 'auth$']; // TODO : choose all caps or all mins
import {ALL, ACTIVE, COMPLETED, IS_LOGGED_IN} from './properties';

App({sinks: sinks}, [
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
      on: 'auth$', sinks: sinks
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

TodoComponent = curry(flip(
  StateChart({
    sinks: [sinkNames],
    //some UNIQUE (vs. action requests) identifier for the state chart
    namespace: 'TODO_SC',
    // changed -> to compute x items left, removed -> to compute x items left
    intents: {ADD_ITEM, COMPLETE_ALL, CHILD_CHANGED, CHILD_REMOVED},
    actions: [ADD_ITEM, COMPLETE_ALL],
    responses: ['Store'],
    model$: 0,//{Store.get(namespace)(null), showOnlyActive : settings.routeState},
    transitions: [
      //INIT -> INIT -> ERROR: ?? -> NO GUARD -> ENTRY :
      (event, model$) => {
        // Can have action requests with/out a response if FSM does not care
        // Can be DOM updates, route changes for example, but not ADD_ITEM
        SwitchForEach(model$, List(prepare(model), TodoItemComponent))
      },
      // INIT -> SUCCESS:INIT -> ERROR: ?? -> NO GUARD -> ADD_ITEM :
      (event, model$) => ({
        Store: $.of({command: ADD_TODO, namespace, ref, payload: todoText}),
        // If one wants optimistic update, can also add:
        DOM: model$.map(ADD_ITEM_model_update).map(view)
      }),
      // INIT -> SUCCESS:INIT -> ERROR: ?? -> NO GUARD -> COMPLETE_ALL :
      (event, model$) => ({
        Store: model$.map(childIndex => ({
          namespace,
          reference: childRef(childIndex, parentRef),
          command: UPDATE,
          payload: refValue => setCompleted(refValue)
          // setCompleted = refValue => (refValue.completed = true, refValue)
        }))
      }),
      // ADD_ITEM_ERROR -> ??? -> ERROR: ?? -> NO_GUARD -> AUTO :
// could do multiple retry through this mechanism
    ],
  })
));

