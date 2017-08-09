import { Observable as $ } from "rx"
import { makeFSM } from '../../../../src/components/FSM/FSM';
import { entryComponents, events, fsmSettings, transitions } from './processApplicationFsmDef';
import { fakeOpportunityKey, fakeProjectKey, fakeUserKey } from "../../fixtures"

function getEmptyProject() {
  return {
    name: '',
    description: '',
    ownerProfileKey: ''
  }
}

function getEmptyUserApplicationModel() {
  return {
    user: null, // will have to be filled down the road
    opportunity: {
      description: '',
      authorProfilekey: '',
      isPublic: true,
      name: '',
      project: getEmptyProject(),
      projectKey: '',
      question: '',
      confirmationsOn: false
    },
    teams: {},
    userApplication: {
      opportunityKey: '', userKey: '',
      about: {
        aboutYou: { superPower: '' },
        personal: { legalName: '', preferredName: '', phone: '', zipCode: '', birthday: '' }
      },
      questions: { answer: '' },
      progress: { step: '', hasApplied: false, hasReviewedApplication: false, latestTeamIndex: 0 },
      teams: {}
    },
    errorMessage: null,
    validationMessages: {}
  }
}

const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

// Note : in the case of a routing, ProcessApplication will be called with the keys in setting
export function ProcessApplication(sources) {
  const emptyUserApplicationModel = getEmptyUserApplicationModel();
  if (!emptyUserApplicationModel.userApplication) {
    throw 'Internal error'
  }

  emptyUserApplicationModel.userApplication.opportunityKey = fakeOpportunityKey;
  emptyUserApplicationModel.userApplication.userKey = fakeUserKey;

  const sinks = fsmComponent(sources, {
    model: emptyUserApplicationModel,
    userKey: fakeUserKey,
    opportunityKey: fakeOpportunityKey,
    projectKey : fakeProjectKey
  });

  return {
    DOM: sinks.DOM,
    domainAction$: sinks.domainAction$ || $.never()
  };
}
