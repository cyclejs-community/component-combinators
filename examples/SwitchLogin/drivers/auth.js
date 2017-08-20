export const LOG_IN = 'login';
export const LOG_OUT = 'logout';

export function makeAuthDriver(repository, initLogInState) {
  const user$ = new Rx.BehaviorSubject(initLogInState);

  function authDriver(authSink$) {
    return authSink$.flatMapLatest(({ context, command, payload }) => {
      // NOTE : making it simple, no branching on context for demo
      switch (command) {
        case LOG_IN :
          return repository.setItem('user', { username: payload.username })
            .then(function () {
              user$.onNext({ username: payload.username });
              return true;
            });
        case LOG_OUT :
          return repository.setItem('user', null)
            .then(function () {
              user$.onNext(null);
              return false
            });
        default :
          throw `unknow command ${command}`
      }
    }).startWith(Boolean(initLogInState))
  }

  return {
    user$,
    authDriver,
  }
}
