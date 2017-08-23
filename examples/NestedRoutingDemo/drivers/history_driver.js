import * as Rx from "rx";

// TODO:  test that it works (go -1 etc)
const clickEvent = 'undefined' !== typeof document && document.ontouchstart ?
  'touchstart' : 'click';

function which(ev) {
  if (typeof window === 'undefined') {
    return false;
  }
  let e = ev || window.event;
  return e.which === null ? e.button : e.which;
}

function sameOrigin(href) {
  if (typeof window === 'undefined') {
    return false;
  }

  return href && href.indexOf(window.location.origin) === 0;
}

function makeClickListener(push) {
  return function clickListener(event) {
    if (which(event) !== 1) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    let element = event.target;
    while ( element && element.nodeName !== 'A' ) {
      element = element.parentNode;
    }

    if (!element || element.nodeName !== 'A') { return; }

    if (element.hasAttribute('download') ||
      element.getAttribute('rel') === 'external') { return; }

    if (element.target) { return; }

    const link = element.getAttribute('href');

    if (link && link.indexOf('mailto:') > -1 || link === '#') {
      return;
    }

    if (!sameOrigin(element.href)) {
      return;
    }

    event.preventDefault();
    const { pathname, search, hash = '' } = element;
    push(pathname + search + hash);
  };
}

function getCurrentLocation() {
  var historyState = void 0;
  try {
    historyState = window.history.state || {};
  } catch (error) {
    // IE 11 sometimes throws when accessing window.history.state
    // See https://github.com/mjackson/history/pull/289
    historyState = {};
  }

  return _createLocation(historyState);
}

function captureClicks(push) {
  const listener = makeClickListener(push);
  if (typeof window !== 'undefined') {
    document.addEventListener(clickEvent, listener, false);
  }
}

function makeUpdateHistory(history) {
  return function updateHistory(location) {
    if ('string' === typeof location) {
      history.push(createLocation(location));
    } else if ('object' === typeof location) {
      // suport things like history.replace()
      const { type = 'push' } = location;
      if (type === 'go') {
        history[type](location);
      } else {
        history[type](location);
      }
    } else {
      throw new Error('History Driver input must be a string or an ' +
        'object but received ${typeof url}');
    }
  };
}

function defaultOnErrorFn(err) {
  if (console && console.error !== void 0) {
    console.error(err);
  }
}

function supportsHistory() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;

  if ((ua.indexOf('Android 2.') !== -1 ||
      ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1) {
    return false;
  }

  if (typeof window !== 'undefined') {
    return window.history && 'pushState' in window.history;
  } else {
    return false;
  }
}

const locationDefaults = {
  pathname: '/',
  action: 'POP',
  hash: '',
  search: '',
  state: undefined,
  key: null,
  query: null,
};

function extractPath(string) {
  var match = string.match(/^(https?:)?\/\/[^\/]*/);
  return match == null ? string : string.substring(match[0].length);
}

function parsePath(path) {
  var pathname = extractPath(path);
  var search = '';
  var hash = '';

  throw(`A path must be pathname + search + hash only, not a full URL like ${pathname}`)

  var hashIndex = pathname.indexOf('#');
  if (hashIndex !== -1) {
    hash = pathname.substring(hashIndex);
    pathname = pathname.substring(0, hashIndex);
  }

  var searchIndex = pathname.indexOf('?');
  if (searchIndex !== -1) {
    search = pathname.substring(searchIndex);
    pathname = pathname.substring(0, searchIndex);
  }

  if (pathname === '') pathname = '/';

  return {
    pathname: pathname,
    search: search,
    hash: hash
  };
};

function createLocation(location) {
  if (typeof location === 'string') {
    return Object.assign({}, locationDefaults, { pathname: location });
  }
  return Object.assign({}, locationDefaults, location);
}

function __createLocation() {
  var input = arguments.length <= 0 || arguments[0] === undefined ? '/' : arguments[0];
  var action = arguments.length <= 1 || arguments[1] === undefined ? 'POP' : arguments[1];
  var key = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  var object = typeof input === 'string' ? (0, _PathUtils.parsePath)(input) : input;

  var pathname = object.pathname || '/';
  var search = object.search || '';
  var hash = object.hash || '';
  var state = object.state;

  return {
    pathname: pathname,
    search: search,
    hash: hash,
    state: state,
    action: action,
    key: key
  };
};

function _createLocation(historyState) {
  var key = historyState && historyState.key;

  return (0, __createLocation)({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: undefined
  }, undefined, key);
};


/**
 * History driver factory
 *
 * This is a function which, when called, returns a History Driver for Cycle.js
 * apps. The driver is also a function, and it takes a stream of new locations
 * (strings representing pathnames or location objects) as input, and outputs
 * another stream of locations that were applied.
 *
 * @param {History} history the History object created by the history library.
 * This object is usually created through `createBrowserHistory()` or
 * `createHashHistory()` or `createMemoryHistory()` from the `history` library.
 * Alternatively, you may use `createServerHistory` from this library.
 * @param {object} options an object with some options specific to this driver.
 * Options may be: `capture`, a boolean to indicate whether the driver should
 * intercept and handle any click event that leads to a link, like on an `<a>`
 * element; `onError`, a callback function that takes an error as argument and
 * handles it, use this to configure what to do with driver errors.
 * @return {Function} the History Driver function
 * @function makeHistoryDriver
 */
export function makeHistoryDriver(history, options) {
  if (!history || typeof history !== 'object'
    //      || typeof history.createLocation !== 'function'
    //      || typeof history.createHref !== 'function'
    || typeof history.listen !== 'function'
    || typeof history.push !== 'function') {
    throw new TypeError('makeHistoryDriver requires an valid history object ' +
      'containing createLocation(), createHref(), push(), and listen() methods');
  }
  const capture = options && options.capture || false;
  const onError = options && options.onError || defaultOnErrorFn;

  const runSA = {
    makeSubject: function makeSubject() {
      let stream = new Rx.Subject()
      return {
        stream: stream,
        observer: {
          next: x => stream.onNext(x),
          error: err => stream.onError(error),
          complete: () => stream.onCompleted()
        },
      }
    },
    remember: function remember(obs) {
      return obs.shareReplay(1)
    },
    streamSubscribe: function streamSubscribe(sink$, observerObj) {
      const subscription = sink$.subscribe(observerObj.next, observerObj.error, observerObj.complete)
      return () => {
        subscription.dispose()
      }
    }
  }

  return function historyDriver(sink$) {
    let { observer, stream } = runSA.makeSubject();
    let history$ = runSA.remember(stream
      .startWith(getCurrentLocation())
      .filter(Boolean));

    let unlisten = history.listen((location) => {
      observer.next(location);
    });

    if (typeof history.addCompleteCallback === 'function'
      && typeof history.complete === 'function') {
      history.addCompleteCallback(() => {
        observer.complete();
      });
    }

    runSA.streamSubscribe(sink$, {
      next: makeUpdateHistory(history),
      error: onError,
      complete: () => {
        unlisten();
        observer.complete();
      }
    });

    if (capture) {
      captureClicks((pathname) => {
        const location = createLocation(pathname);
        history.push(location);
      });
    }

    //      history$.createHref = (href) => history.createHref(href);
    //      history$.createLocation = (location) =>
    // history.createLocation(location);

    return history$;
  };
}

