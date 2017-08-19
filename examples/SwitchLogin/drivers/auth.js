export const LOG_IN = 'login';
export const LOG_OUT = 'logout';

export function makeAuthDriver(repository, initLogInState){
  const user$ = new Rx.BehaviorSubject(initLogInState);

  function authDriver(authSink$){
    return authSink$.map(({context, command, payload}) => {
      // NOTE : making it simple, no branching on context for demo
      switch (command) {
        case LOG_IN :
          repository.setItem('user', {username: payload.username})
          user$.onNext({username: payload.username});
          return true
        case LOG_OUT :
          repository.setItem('user', null)
          user$.onNext(null);
          return false
        default :
          throw `unknow command ${command}`
      }
    })
  }

  return {
    user$,
    authDriver,
  }
}
