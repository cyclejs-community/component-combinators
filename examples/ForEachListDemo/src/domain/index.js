export const OPPORTUNITY = 'OPPORTUNITY';
export const USER_APPLICATION = 'USERAPP';
export const CARDS = 'CARDS';
export const PAGE = 'PAGE';
export const PAGE_REF = 'Page';
export const UPDATE = 'Update';

export const domainObjectsQueryMap = {
  [PAGE]: {
    get: function getPageNumber(repository, context, payload) {
      return repository.getItem(PAGE_REF);
    }
  },
  [CARDS]: {
    get: function getCardPage(repository, context, payload) {
      const { page } = payload;
      const localforageKey = page + "";

      return repository.getItem(localforageKey);
    }
  },
};

export const domainActionsConfig = {
  [PAGE]: {
    [UPDATE]: function updateUserApplication(repository, context, payload) {
      void context;

      const { page } = payload;
      const localforageKey = PAGE_REF;

      console.log('update page: ', context, localforageKey, payload);

      return repository.setItem(localforageKey, payload);
    }
  },
};
