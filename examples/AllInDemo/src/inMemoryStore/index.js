import { NO_VALUE } from "../properties"
import { memoizeWith } from 'ramda'
import * as Rx from "rx";
import * as jsonpatch from "fast-json-patch"
import { isArrayUpdateOperations } from "../../../../src/components/types"

const $ = Rx.Observable;

export const TASK_TAB_BUTTON_GROUP_STATE = 'task_tab_button_group_state';
export const PATCH = 'patch';

export const inMemoryStoreQueryMap = {
  [TASK_TAB_BUTTON_GROUP_STATE]: {
    getCurrent: function get(repository, context, payload) {
      if (!payload) throw `inMemoryStateDriver > inMemoryStoreQueryMap > ${TASK_TAB_BUTTON_GROUP_STATE} > get : payload should not be null!`

      return $.of(repository[context])
    }
  },
};

export const inMemoryStoreActionsConfig = {
  [TASK_TAB_BUTTON_GROUP_STATE]: {
    [PATCH]: function patch(repository, context, payload) {
      // payload is an array of JSON patch format { op, path, value }
      assertContract(isArrayUpdateOperations, [payload],
        `domainActionsConfig > updateUserApplication : payload is not a valid jsonpatch object!`);

      jsonpatch.apply(repository[context], payload);

      // NOTE : modifies IN PLACE!!
      return repository[context]
    }
  },
};
