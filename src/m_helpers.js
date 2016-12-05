// TODO : there is also the `isolate` stuff to incorporate
// TODO : document the advantages/disadvantages of this approach
// TODO : write proper tests
// TODO : find a way to stream the graph out -> to a debug/graph sink
// TODO : document all helpers

///////////////
// Utils helper function

///////////////
// Component helper function
const makeProvider = (firebase, scopes) => {
  const provider = new firebase.auth.GoogleAuthProvider()
  provider.addScope('profile')
  provider.addScope('email')
  return $.just(provider); // TODO : make sure that this is executed on the immediate scheduler in most, not to loose a tick each time
}

///////////////
// Components definition
// TODO : document every component function (options, sources : mandatory, optional etc.)

function LogoutButton(sources, options) {
  return {
    auth$: sources.DOM.select(options.classes) // i.e. '.google-logout'
      .events('click')
      .withLatestFrom(sources.provider$, (click, provider) => {type: options.authType, provider}),
    DOM: $.just(button(options.classes, options.polyglot)),
  }
}

function LoginButton(sources, options) {
  return {
    auth$: sources.DOM.select(options.classes) // i.e. '.google-login'
      .events('click')
      .withLatestFrom(sources.provider$, (click, provider) => {type: options.authType, provider}),
    DOM: Button({...sources, phrase$: $.just(options.phrase)}).DOM
  }
}

function LoggedIn(sources, options) {
  return {
    authFilter$: sources.auth$
      .filter(user => !!user === options.authBranch)
  }
}

function LoggedOut(sources, options) {
  return {
    authFilter$: sources.auth$
      .filter(user => !!user !== options.authBranch)
  }
}

function QueueActionOnAuth(sources, options) {
  return {
    queue$: sources.auth$
      .filter(x => !!x === options.authBranch)
      .map(user => ({
        domain: options.domain,
        action: options.action,
        ...user.providerData[0],
  }
))
}
}

// Page component definition
const Landing = m(null, null, {
  makeLocalSources: sources => {
    return {
      provider$: makeProvider(firebase, ['profile', 'email']),
      auth$: sources.auth$.startWith(undefined),
    }
  },
  mergeSinks: (ownSinks, childrenSinks, settings) => {
    // combineLatest :: Array Observable T -> Observable Array T
    // merge :: Array Observable T -> Observable T

    return {
      // ! DOM sinks should most of the time be merged the same way. If that is the case, factor it out
      // ! non DOM sinks should most of the time be merged the same way. If that is the case, factor it out
      // as a default merge function

      // childrenSinks :: Array Sinks = Array Hash Observable T
      // childrenSinks.map(x => x.DOM) :: Array Observable<VNode>
      // so here Observable<Array VNode>
      // ?? Is that what `combineDomToDiv` already does?
      // TODO : in the factored out `merge` functions, add ownSinks at the BEGINNING of childrenSinks array before merging
      DOM: $.combineLatest(childrenSinks.map(x => x.DOM)).map(arrayVNode => div(arrayVNode)),
      auth$: mergeNonDomSinksDefault(ownSinks, childrenSinks, 'auth$'),
      queue$: mergeNonDomSinksDefault(ownSinks, childrenSinks, 'queue$'),
    }
  }
}, [
  m(LoggedIn, {authBranch: 'true'}, {
    mergeSinks: (ownSinks, childrenSinks) => {
      // Only accept the children sinks if the user is already identified (`authBranch: 'true'`)
      return R.map(sink => ownSinks.authFilter$.map(sink), childrenSinks)
    }
  }, [
    mdiv(null, null, [
      mdiv('.logged-in', sources => sources.auth$.map(user => `Logged in as ${user.providerData[0].email}`)),
      mdiv([ // ?? is that wrapping div useful?
        m(LogoutButton, {
          classes: '.google-logout',
          authType: 'logout',
          polyglot: {phrase: 'logout', name: 'Logout'}
        }, {}, [])
      ])
    ])
  ]),
  m(LoggedOut, {authBranch: 'false'}, {
    mergeSinks: (ownSinks, childrenSinks) => {
      // Only accept the children sinks if the user is not already logged in (`authBranch: 'false'`)
      return R.map(sink => ownSinks.authFilter$.map(sink), childrenSinks)
    }
  }, [
    mdiv(null, null, [
      h1('.welcome', 'Sparks.Network'),
      m(LoginButton, {phrase: 'loginGoogle', authType: 'popup'}, {}, []),
    ])
  ]),
  m(QueueActionOnAuth, {
    authBranch: 'true',
    domain: 'Profiles',
    action: 'create'
  }, null, [])
]);

// mdiv :: Opt Selector -> Settings | Settings$Fn -> [VNode|Component] | Text$Fn
function mdiv(selector, modulesOrFn, childrenOrFn) {
  // TODO : propagate and recursively merge also the non DOM sinks, mdiv should have a default mergeSinks which
  // just let pass non DOM sinks

  var overloads = [
    // Overload `Selector -> (Settings\|Settings$Fn) -> ([VNode\|Component] \| Text$Fn)-> Component`
    {selector: isString}, {settings: or(isNull, isObject)}, {children: isArray}, // 1.
    {selector: isString}, {settings: or(isNull, isObject)}, {text$Fn: isFunction}, // 2.
    {selector: isString}, {settingsFn: isFunction}, {children: isArray}, // 3.
    {selector: isString}, {settingsFn: isFunction}, {text$Fn: isFunction}, // 4.
    // Overload `Selector -> ([VNode\|Component] \| Text$Fn)-> Component`
    {selector: isString}, {children: isArray}, // 5.
    {selector: isString}, {text$Fn: isFunction}, // 6.
    // Overload `[VNode\|Component]-> Component`
    {children: isArray}, // 7.
  ];
  // unfoldOverload :: Arguments -> [Overload] -> Opt Hash *
  // returns a hash of arguments attributed to the properties corresponding to the overloaded signature detected
  // or null if no valid signature could be found
  // In case of duplicate or overlapping overload, the first one who is found will trigger the arguments attribution
  // TODO : could return also the number of the overload, so we can more clearly
  // make sure the case that is covered later on
  var args = unfoldOverload(arguments, overloads);

  var divCurried = function (selector) {
    return function (settings) {
      return function (text) {
        return div(selector, settings || {}, text);
      }
    }
  }

  if (args.selector && !args.settingsFn && args.text$Fn) {
    // Covers 2, 6
    var divText = divCurried(args.selector)(args.settings);

    // Check type contracts
    assert_contract(text$, isObservableContract, 'text producing function must return an observable!');

    return function (sources, parentSettings) {
      var text$ = args.text$Fn(sources, parentSettings);

      // In this case, there is no children, and only a (settings, text) is to be associated to the selector
      // So this affects only the DOM
      return {
        DOM: $.combineLatest(text$, function (text) {return divText(text);}
        )
      }
    }
  }
  else if (args.children && !args.settingsFn) {
    // Covering 1, 5, 7
    // Two cases are joined here : mdiv (selector, ...) or mdiv ([...])
    // To each case correspond a div overload : div (selector, ...) or div([])
    var divFn = args.selector ?
      divCurried(args.selector)(args.settings) :
      div;

    // Then children is an array of components or VNodes (case where `h` is used directly)
    return function (sources, parentSettings) {
      var children = args.children;
      var emptyChildrenDomSink = children.length === 0;
      var childrenDOMSink = null;

      if (emptyChildrenDomSink) {
        // Case mdiv (..., [])
        return {
          DOM: divFn([])
        }
      }
      else {
        // Case mdiv (..., [...])
        // childrenDOMSink :: [Opt Observable VNode]
        childrenDOMSink = project('DOM', children, sources, settings);

        return {
          DOM: $.combineLatest(
            // NOTE : null values have to be removed as they could break the `div` and `h` helper which do not defend
            // against them
            // removeNullValues :: [Opt T] -> [T]
            // returns an array without null elements
              // TODO : edge case where the returning array is empty!!
            removeNullValues(childrenDOMSink),
            // arrayVNode :: [VNode]
            function (arrayVNode) { return divFn(arrayVNode); } // i.e. divFn (kept for clarity)
          )
        }
      }
    }
  }
  else if (args.selector && args.settingsFn && args.text$Fn) {
    // Covers 4
    // Then first Fn :: Sources -> Observable Settings, the other Fn returns Observable String as before

    return function (sources, parentSettings) {
      var divSelector = divCurried(selector);
      var settings$ = args.settingsFn(sources, parentSettings);
      var text$ = args.text$Fn(sources, parentSettings);

      return {
        DOM: $.combineLatest(
          settings$,
          text$,
          function (settings, text) {return divSelector(settings, text);}
        )
      }
    }
  }
  else if (args.selector && args.settingsFn && args.children) {
    // Covers 3
    // Then children is an array of components or VNodes (case where `h` is used directly)
    return function (sources, parentSettings) {
      var children = args.children;
      var emptyChildrenDomSink = children.length === 0;
      var divSelector = divCurried(selector);
      var settings$ = args.settingsFn(sources, parentSettings);
      var childrenDOMSink = null;

      if (emptyChildrenDomSink) {
        // Case mdiv (..., [])
        return {
          DOM: $.combineLatest(
            settings$,
            function (settings) {return divSelector(settings, []);}
          )
        };
      }
      else {
        // Case mdiv (..., [...])
        // childrenDOMSink :: [Opt Observable VNode]
        childrenDOMSink = project('DOM', children, sources, settings);
        // Add settings$ to the array as used `combineLatest` overload takes only one array
        childrenDOMSink.push(settings$);

        return {
          DOM: $.combineLatest(
            // arrayVNode :: [VNode]
            removeNullValues(settingsAndchildrenDOMSink),
            function (settingsAndchildrenDOMSink, arrayVNode) {
              var settings = settingsAndchildrenDOMSink.pop();
              return divSelector(settings, settingsAndchildrenDOMSink);
            }
          )
        }
      }

      // If modulesOrFn is Fn && childrenOrFn is children
      //   | // Then children is an array of components
      //   | return Sources -> Sinks
      //   |        (sources)=> {
      //   |           DOM :
      //   |             $.just((modules, children) => div (selector, modules, children)),
      //   |             arraysVNodes$ <- $.combineLatest $ project 'DOM' $ map children sources,
      //   |             (f, x, y) => f(x, y)

    }
  }
  else {
    throw 'mdiv : unexpected case?!'
  }
}

// mdiv algorithm
// Sources :: Hash Observable
// Sinks :: Hash Observable
// Component :: Sources -> Settings -> Sinks
// mdiv :: Selector -> Optional Modules -> [Component] | Function -> Component
// .where Selector :: String
//       Function ?? returns only text, no children for now, i.e. children array is static when present
// If modulesOrFn is modules && childrenOrFn is Fn
//   | // Then Fn returns Observable <String> - could also be String lifted in Observable <String>)
//   | return Sources -> Sinks
//   |       (sources)=> {
//   |       DOM : $.combineLatest(
//   |                  $.just(text => div (selector, modules, text)),
//   |                  fn(sources),
//   |                  (f, x) => f(x)
//   |                  )
//   |       }
// If modulesOrFn is modules && childrenOrFn is children
//   | // Then children is an array of components
//   | return Sources -> Sinks
//   |        (sources)=> {
//   |           DOM :
//   |             // $.just((modules, children) => div (selector, modules, children)),
//   |             arraysVNodes$ <- $.combineLatest $ map (children $ sources) (project 'DOM'),
//   |             // should give back Array Sinks of which we keep only the DOM part which is Observable <vNode>
//   |             // so we now have Array Observable <vdom> applied to combineLatest, i.e. Observable Array <vNode>
//   |             // returned
//   |             map arraysVNodes$ (arrayVNodes => div (selector, modules, arrayVNodes))
//   |             // That `map` returns an Observable <vNode> which is what we want
//   |           )
//   |        }
// If modulesOrFn is Fn && childrenOrFn is Fn
//   | // Then first Fn :: Sources -> Observable <Optional Modules>, the other Fn returns Observable <String> as before
//   | return Sources -> Sinks
//   |       (sources)=> {
//   |       DOM : $.combineLatest(
//   |                  $.just((modules, text) => div (selector, modules, text)),
//   |                  fnModule(sources),
//   |                  fnText(sources),
//   |                  (f, x, y) => f(x, y)
//   |                  )
//   |       }
// If modulesOrFn is Fn && childrenOrFn is children
//   | // Then children is an array of components
//   | return Sources -> Sinks
//   |        (sources)=> {
//   |           DOM :
//   |             $.just((modules, children) => div (selector, modules, children)),
//   |             arraysVNodes$ <- $.combineLatest $ project 'DOM' $ map children sources,
//   |             (f, x, y) => f(x, y)

// Typings for h and VNode :
// - VNode(selector, data, children, text, undefined);
// - h(selector, data, [children]|text)
// | h(selector, [children]|text)
// | h([children])

// Example mermaid
// graph
// TB
//
// subgraph
// TabbedComponent
// subgraph
// TabEMEA
// subgraph
// SourcesTabEMEA
// DOMTabEMEA(DOM)
// FirebaseTabEMEA(Firebase)
// SalesTabEMEA(salesEMEA)
// end
//
// subgraph
// SinksTabEMEA
// SinkDOMTabEMEA(DOM)
// SinkActionTabEMEA(Action)
// end
//
// DOMTabEMEA-- > bodyEMEA(...)
// FirebaseTabEMEA(Firebase)-- > bodyEMEA(...)
// alesTabEMEA(salesEMEA)-- > bodyEMEA(...)
// bodyEMEA-- > SinkDOMTabEMEA
// bodyEMEA-- > SinkActionTabEMEA
// end
//
// subgraph
// TabAmerica
// subgraph
// SourcesTabAmerica
// DOMTabAmerica(DOM)
// FirebaseTabAmerica(Firebase)
// SalesTabAmerica(salesAmerica)
// end
//
// subgraph
// SinksTabAmerica
// SinkDOMTabAmerica(DOM)
// SinkActionTabAmerica(Action)
// end
//
// DOMTabAmerica-- > bodyAmerica(...)
// FirebaseTabAmerica(Firebase)-- > bodyAmerica(...)
// SalesTabAmerica(salesAmerica)-- > bodyAmerica(...)
// bodyAmerica-- > SinkDOMTabAmerica
// bodyAmerica-- > SinkActionTabAmerica
// end
//
// subgraph
// SourcesTabbedComponent
// subgraph
// ExtraSourcesTabbedComponent
// SalesTabbedComponentEMEA(salesEMEA)
// SalesTabbedComponentAmerica(salesAmerica)
// end
//
// DOMTabbedComponent(DOM)
// FirebaseTabbedComponent(Firebase)
// end
//
// subgraph
// SinksTabbedComponent
// SinkDOMTabbedComponent(DOM)
// SinkActionTabbedComponent(Action)
// end
//
// DOMTabbedComponent(DOM)-- > DOMTabEMEA
// DOMTabbedComponent-- > DOMTabAmerica
// FirebaseTabbedComponent(Firebase)-- > FirebaseTabEMEA
// FirebaseTabbedComponent-- > FirebaseTabAmerica
//
// SalesTabbedComponentEMEA-- > SalesTabEMEA
// SalesTabbedComponentAmerica-- > SalesTabAmerica
//
// SinkDOMTabAmerica-- > SinkDOMTabbedComponent
// SinkDOMTabEMEA-- > SinkDOMTabbedComponent
//
// SinkActionTabAmerica-- > SinkActionTabbedComponent
// SinkActionTabEMEA-- > SinkActionTabbedComponent
//
// end

// Given a sketch of Sparks landing page

// The landing page could be written as :
// Note : in principle there is no need for explicit isolation as every component has a unique path by construction
import {Route, Auth} from 'utils/components'
import {Button} from 'components'

const LoginPage = m(null, null, null, [
  m(Route, {route: '/'}, {}, [
    m(Auth, {case: true}, {}, [
      LoggedInView
    ]),
    m(Auth, {case: false}, {}, [
      LoggedOutView
    ]),
  ]),
  m(Route, {route: 'dash/being'}, {}, [
    m(Auth, {case: true}, {
      makeExtraSources: (sources, settings) => ({
        userProfile$: TODO,
        etc
      })
    }, [
      DashboardPage // TODO
    ]),
    m(Auth, {case: false}, {}, [
      LoggedOutView
    ]),
  ])
])

const LoggedInView = m(Redirect, {redirect: 'dash/being'}, null, [])

const LoggedOutView = m(null, null, null, [
  m(Container, {
    imageSrc: './...jpg',
    class: {'interstitial-login': true, 'sparks-dialog': true}
  }, [
    mdiv('.logo', []),
    mdiv('', 'We need to know who you are'),
    mdiv('.buttons', [
      m(SignInAction, null, {
        mergeSinks: (_, [{signInGoogle$}], settings) => ({
          queue$: TODO,
          auth$: TODO
        })
      }, [
        m(Button, {click: 'signInGoogle'}, [
          mdiv('', {class: {google: true, 'sign-in': true}}, [
            h('i', {class: {'icon-google': true}}, []),
            h('span', 'Sign in with Google')
          ])
        ])
      ]),
      m(SignInAction, null, {
        mergeSinks: (_, [{signInFacebook$}], settings) => ({
          queue$: TODO,
          auth$: TODO
        })
      }, [
        m(Button, {click: 'signInFacebook'}, [
          mdiv('', {class: {facebook: true, 'sign-in': true}}, [
            h('i', {class: {'icon-facebook-official': true}}, []),
            h('span', 'Sign in with Facebook')
          ])
        ])
      ])
    ])
  ])
])

// Sinks : VDOM
// VDOM tree should produce this DOM
// <div class="sparks-dialog interstitial-login" style="background">
//   <div class="logo"></div>
//   <div>We need to know who you are</div>
//   <div class="buttons">
//     <button class="google sign-in">
//       <i class="icon-google"></i>
//       Sign in with Google
//     </button>
//     <button class="facebook sign-in">
//       <i class="icon-facebook-official"></i>
//       Sign in with Facebook
//     </button>
//   </div>
// </div>

// Sinks : `queue$`
// `LoginPage.queue$` will be built by reducing the `queue` sink from the `SignInAction` component

// Sinks : `auth$`
// `LoginPage.auth$` will be built by reducing the 2 `queue` sinks from the 2 `SignInAction` components

// Sink reduction is performed using default reducing functions
// (similar to current `combineDOMtoDivs` and `mergeOrFlatMapLatest`)
// If the default is inappropriate, a custom reducer can be passed using the `mapReduce` parameter
// of the `m` helper
