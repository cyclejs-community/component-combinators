export * from './sources';
export * from './sinks';
export * from './repository';
export * from './domain';
export * from './processApplication';

export interface PredicateOrError {
  () : boolean | string
}
