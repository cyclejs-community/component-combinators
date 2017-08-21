export const LOG_IN = 'login';
export const LOG_OUT = 'logout';

export function makeAuthDriver(repository, initLogInState) {
  function authDriver(authSink$) {
    return authSink$.flatMapLatest(({ context, command, payload }) => {
      // NOTE : making it simple, no branching on context for demo
      switch (command) {
        case LOG_IN :
          return repository.setItem('user', { username: payload.username })
            .then(function () {
              return true;
            });
        case LOG_OUT :
          return repository.setItem('user', null)
            .then(function () {
              return false
            });
        default :
          throw `unknow command ${command}`
      }
    }).startWith(Boolean(initLogInState))
  }

  return authDriver
}
