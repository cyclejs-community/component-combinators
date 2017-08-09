import { Sources } from '@motorcycle/core';
import { DomSource } from '@motorcycle/dom';

export interface DomSources extends Sources {
  dom: DomSource;
}
