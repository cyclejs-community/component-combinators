export function WithState(withStateSettings, componentTree){
  // TODO : put a specific trace to mark actions for future tracer
  return m({}, withStateSettings, componentTree)
}
