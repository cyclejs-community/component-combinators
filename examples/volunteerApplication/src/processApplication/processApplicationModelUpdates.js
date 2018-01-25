import { curry, flatten, keys, merge, pick, reduce } from 'ramda';
import {
  addOpToJsonPatch, chainModelUpdates, getSelectedKey, toJsonPatch
} from '../../../../src/components/FSM/utils';
import {
  aboutYouFields, personalFields, questionFields, STEP_ABOUT, STEP_QUESTION, STEP_REVIEW,
  STEP_TEAM_DETAIL, STEP_TEAMS
} from './properties';
import { assertContract } from "../../../../utils/contracts/src/index"
import { checkUserApplicationContracts } from '../domain/contracts';

function _updateModelWithStepOnly(step, model, eventData,
                                  actionResponse) {
  return flatten([addOpToJsonPatch('/userApplication/progress/step', step)])
}

export const updateModelWithStepOnly = curry(_updateModelWithStepOnly);

export function initializeModel(model, eventData, actionResponse, settings) {
  let initialModel;
  const { userKey, opportunityKey, projectKey } = settings;
  const { user, opportunity, teams, project, userApplication } = eventData;
  // opportunity here is the Opportunity whose key is somehow encoded in the URL
  // teams is all the teams for that opportunity

  if (!userApplication) {
    // build the teamsInfo param of user application by mapping team key to initial values
    const teamsInfo = reduce((acc, team) => {
      const { description, name, question, teamKey } = team;
      acc[teamKey] = { description, name, question, answer: '', hasBeenJoined: false };

      return acc
    }, {}, teams);

    initialModel = {
      user: user,
      opportunity: opportunity,
      teams: teams,
      project: project,
      errorMessage: null,
      userApplication: {
        userKey: userKey,
        opportunityKey: opportunityKey,
        about: {
          aboutYou: { superPower: '' },
          personal: { phone: '', preferredName: '', zipCode: '', legalName: '', birthday: '' }
        },
        questions: { answer: '' },
        teams: teamsInfo,
        progress: {
          step: STEP_ABOUT,
          hasApplied: false,
          hasReviewedApplication: false,
          latestTeamIndex: 0
        }
      },
      validationMessages: {}
    }
  }
  else {
    assertContract(checkUserApplicationContracts, [userApplication], `
user application read from the database is corrupted. 
Please check fields for correctness vs. expected format
`);

    const { progress: { hasApplied, step } } = userApplication;
    const updatedUserApplication = hasApplied
      ? merge(userApplication, { progress: { step: STEP_REVIEW } })
      : userApplication;

    console.log('updatedUserApplication', userApplication);

    initialModel = {
      user,
      opportunity,
      teams,
      project,
      userApplication,
      errorMessage: null,
      validationMessages: {}
    }
  }

  return toJsonPatch('')(initialModel);
}

export const initializeModelAndStepReview = chainModelUpdates([
  initializeModel,
  updateModelWithStepOnly(STEP_REVIEW)
]);

function _updateModelWithStepAndError(updateModelFn, step, model,
                                      eventData, actionResponse) {
  console.log('_updateModelWithStepAndError');
  const { err } = actionResponse;

  return flatten([
    updateModelFn(model, eventData.formData, actionResponse),
    addOpToJsonPatch('/userApplication/progress/step', step),
    addOpToJsonPatch('/errorMessage', err ? err.toString() : 'internal error! there should be an error message')
  ])
}

export const updateModelWithStepAndError = curry(_updateModelWithStepAndError);

export const updateModelWithAboutDataAndStepQuestion = chainModelUpdates([
  updateModelWithAboutData,
  updateModelWithEmptyErrorMessages,
  updateModelWithStepOnly(STEP_QUESTION)
]);

export const updateModelWithAboutDataAndStepReview = chainModelUpdates([
  updateModelWithAboutData,
  updateModelWithEmptyErrorMessages,
  updateModelWithStepOnly(STEP_REVIEW)
]);

export function updateModelWithAboutData(model, eventData,
                                         actionResponse) {
  console.log('updateModelWithAboutData');
  const formData = eventData.formData;

  return flatten([
    toJsonPatch('/userApplication/about/aboutYou')(pick(aboutYouFields, formData)),
    toJsonPatch('/userApplication/about/personal')(pick(personalFields, formData)),
  ])
}

export function updateModelWithEmptyErrorMessages(model, eventData,
                                                  actionResponse) {
  console.log('updateModelWithEmptyErrorMessages');

  return flatten([toJsonPatch('/validationMessages')({}), toJsonPatch('/errorMessage')(null)])
}

export function updateModelWithQuestionDataAndStepReview(model, eventData,
                                                         actionResponse) {
  console.log('updateModelWithQuestionDataAndStepReview');
  const formData = eventData.formData;

  return flatten([
    patchModelWithQuestionData(formData),
    addOpToJsonPatch('/userApplication/progress/step', STEP_REVIEW),
  ])
}

export function updateModelWithQuestionData(model, eventData,
                                            actionResponse) {
  console.log('updateModelWithQuestionData');
  const formData = eventData.formData;

  return patchModelWithQuestionData(formData)
}

export const updateModelWithQuestionDataAndTeamsStep = chainModelUpdates([
  updateModelWithQuestionData,
  updateModelWithEmptyErrorMessages,
  updateModelWithStepOnly(STEP_TEAMS)
]);

function patchModelWithQuestionData(formData) {
  return flatten([
    toJsonPatch('/userApplication/questions')(pick(questionFields, formData)),
    addOpToJsonPatch('/userApplication/progress/step', STEP_TEAMS),
    addOpToJsonPatch('/validationMessages', {}),
    addOpToJsonPatch('/errorMessage', null),
  ])
}

export function updateModelWithSelectedTeamData(model, eventData,
                                                actionResponse) {
  const selectedTeamIndex = eventData;

  console.log('updateModelWithSelectedTeamData', eventData);

  return flatten([
    addOpToJsonPatch('/userApplication/progress/latestTeamIndex', selectedTeamIndex),
    addOpToJsonPatch('/userApplication/progress/step', STEP_TEAM_DETAIL),
  ])
}

export function updateModelWithSkippedTeamData(model, eventData,
                                               actionResponse) {
  const { userApplication: { progress: { latestTeamIndex }, teams } } = model;
  const teamKeys = keys(teams);
  const numberOfTeams = teamKeys.length;
  const selectedTeamKey = getSelectedKey(latestTeamIndex, teamKeys);
  const { formData: { answer } } = eventData;
  // loop back to first team if met end of teams
  const nextTeamIndex = (latestTeamIndex + 1) % numberOfTeams;

  console.log('updateModelWithSkippedTeamData', latestTeamIndex, selectedTeamKey, nextTeamIndex, answer);

  return flatten([
    addOpToJsonPatch('/validationMessages', {}),
    addOpToJsonPatch('/userApplication/progress/latestTeamIndex', nextTeamIndex),
    addOpToJsonPatch('/userApplication/progress/step', STEP_TEAM_DETAIL),
    addOpToJsonPatch(`/userApplication/teams/${selectedTeamKey}/answer`, answer),
  ])
}

export function updateModelWithJoinedOrUnjoinedTeamData(model,
                                                        eventData,
                                                        actionResponse) {
  const { userApplication: { teams, progress: { latestTeamIndex } } } = model;
  const teamKeys = keys(teams);
  const numberOfTeams = teamKeys.length;
  const selectedTeamKey = getSelectedKey(latestTeamIndex, teamKeys);
  const { formData: { answer } } = eventData;
  const { hasBeenJoined } = teams[selectedTeamKey];
  // loop back to first team if met end of teams
  const nextTeamIndex = (latestTeamIndex + 1) % numberOfTeams;

  console.log('updateModelWithJoinedTeamData', latestTeamIndex, nextTeamIndex, selectedTeamKey, hasBeenJoined);

  return flatten([
    addOpToJsonPatch('/validationMessages', {}),
    addOpToJsonPatch('/userApplication/progress/latestTeamIndex', nextTeamIndex),
    addOpToJsonPatch('/userApplication/progress/step', STEP_TEAM_DETAIL),
    addOpToJsonPatch(`/userApplication/teams/${selectedTeamKey}/answer`, answer),
    addOpToJsonPatch(`/userApplication/teams/${selectedTeamKey}/hasBeenJoined`, !hasBeenJoined),
  ])
}

export const updateModelWithTeamDetailAnswerAndNextStep = chainModelUpdates([
  updateModelWithStepOnly(STEP_TEAMS),
  updateModelWithTeamDetailAnswerData
]);

export function updateModelWithStepAndHasReviewed(model, eventData,
                                                  actionResponse) {
  return flatten([
    addOpToJsonPatch('/userApplication/progress/step', STEP_REVIEW),
    addOpToJsonPatch('/userApplication/progress/hasReviewedApplication', true),
  ])
}

export function updateModelWithAppliedData(model, eventData,
                                           actionResponse) {
  return flatten([addOpToJsonPatch('/userApplication/progress/hasApplied', true),])
}

function updateModelWithValidationData(model, eventData,
                                       actionResponse) {
  const { validationData } = eventData;
  console.log('updateModelWithValidationData', validationData);

  return toJsonPatch('/validationMessages')(validationData);
}

function updateModelWithTeamDetailAnswerData(model, eventData,
                                             actionResponse) {
  const { userApplication: { progress: { latestTeamIndex }, teams } } = model;
  const teamKeys = keys(teams);
  const selectedTeamKey = getSelectedKey(latestTeamIndex, teamKeys);
  const { answer } = eventData;

  console.log('updateModelWithTeamDetailAnswerData', latestTeamIndex, selectedTeamKey, answer);

  return flatten([
    addOpToJsonPatch(`/userApplication/teams/${selectedTeamKey}/answer`, answer),
  ])
}

export const updateModelWithTeamDetailValidationMessages = chainModelUpdates([
  updateModelWithTeamDetailAnswerData,
  updateModelWithValidationData,
  updateModelWithStepOnly(STEP_TEAM_DETAIL)
]);

export const updateModelWithAboutValidationMessages = chainModelUpdates([
  updateModelWithAboutData,
  updateModelWithValidationData,
  updateModelWithStepOnly(STEP_ABOUT)
]);

export const updateModelWithQuestionValidationMessages = chainModelUpdates([
  updateModelWithQuestionData,
  updateModelWithValidationData,
  updateModelWithStepOnly(STEP_QUESTION)
]);
