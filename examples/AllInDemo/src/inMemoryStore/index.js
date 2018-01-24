import * as Rx from "rx";
import * as jsonpatch from "fast-json-patch"
import { isArrayUpdateOperations } from "../../../../src/components/types"
import { assertContract } from "../../../../utils/contracts/src/index"

const $ = Rx.Observable;

export {getStateInStore} from './helpers'

export const TASKS_FILTER = 'task_tab_button_group_state';
export const PATCH = 'patch';

export const inMemoryStoreQueryMap = {
  [TASKS_FILTER]: {
    get: function get(repository, context, payload) {
      return $.of(repository[context])
    }
  },
};

export const inMemoryStoreActionsConfig = {
  [TASKS_FILTER]: {
    [PATCH]: function patch(repository, context, payload) {
      // payload is an array of JSON patch format { op, path, value }
      assertContract(isArrayUpdateOperations, [payload],
        `domainActionsConfig > updateUserApplication : payload is not a valid jsonpatch object!`);
      repository[context] = repository[context] || {};

      jsonpatch.apply(repository[context], payload);

      // NOTE : modifies IN PLACE!!
      return repository[context]
    }
  },
};
