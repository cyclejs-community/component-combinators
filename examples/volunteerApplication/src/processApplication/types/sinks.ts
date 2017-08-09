import { Sinks } from '@motorcycle/core';
import { RouterInput } from '@motorcycle/router';

export interface RouterSinks extends Sinks {
  router: RouterInput;
}
