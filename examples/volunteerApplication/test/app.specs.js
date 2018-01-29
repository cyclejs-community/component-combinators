import * as QUnit from "qunitjs"
import { runTestScenario } from "../../../utils/testing/src/runTestScenario"
import * as Rx from "rx"
import { pipe } from "ramda"
import { ProcessApplication } from "../src/processApplication/index"
import { makeMockDOMSource } from "../../../utils/testing/src/mocks/mockDOM"
import { makeMockDocumentSource } from "../../../utils/testing/src/mocks/mockDocument"
import { makeDomainQuerySource } from "../../../utils/testing/src/mocks/mockDomainQuery"
import { convertVNodesToHTML} from "../../../utils/debug/src/index"
import { noop, stripHtmlTags } from "../../../utils/utils/src/index"
import {
  OPPORTUNITY, OPPORTUNITY_REF, PROJECTS, PROJECTS_REF, TEAMS, TEAMS_REF, USER_APPLICATION
} from "../src/domain/index"
import {
  defaultUser, fakeOpportunityKey, fakeProjectKey, fakeUserKey, opportunities, projects, teams
} from "../fixtures"
import {
  ABOUT_YOU, COMPLETE_YOUR_APPLICATION_FOR, CONTINUE, LOADING_USER_APPLICATION_DATA,
  PERSONAL_DETAILS, STEP_ABOUT, STEP_QUESTION, STEP_REVIEW, STEP_TEAMS,
  USER_APPLICATION_BACK_TO_TEAMS_SELECTOR,
  USER_APPLICATION_FORM_INPUT_BIRTHDAY_SELECTOR, USER_APPLICATION_FORM_INPUT_LEGAL_NAME_SELECTOR,
  USER_APPLICATION_FORM_INPUT_OPP_ANSWER_SELECTOR, USER_APPLICATION_FORM_INPUT_PHONE_SELECTOR,
  USER_APPLICATION_FORM_INPUT_PREFERRED_NAME_SELECTOR,
  USER_APPLICATION_FORM_INPUT_SUPERPOWER_SELECTOR, USER_APPLICATION_FORM_INPUT_TEAM_ANSWER_SELECTOR,
  USER_APPLICATION_FORM_INPUT_ZIPCODE_SELECTOR, USER_APPLICATION_JOIN_UNJOIN_TEAM_SELECTOR,
  USER_APPLICATION_REVIEW_ABOUT_SELECTOR, USER_APPLICATION_REVIEW_OPP_QUESTION_SELECTOR,
  USER_APPLICATION_REVIEW_SUBMIT_SELECTOR, USER_APPLICATION_REVIEW_TEAMS_SELECTOR,
  USER_APPLICATION_SKIP_TEAM_SELECTOR, USER_APPLICATION_TEAMLIST_SELECTOR,
  USER_APPLICATION_ABOUT_CONTINUE_BUTTON_SELECTOR, USER_APPLICATION_QUESTION_CONTINUE_BUTTON_SELECTOR,
  USER_APPLICATION_TEAM_CONTINUE_BUTTON_SELECTOR
} from "../src/processApplication/properties"
import {
  MANDATORY_PLEASE_FILL_IN_VALID_ERROR, MIN_LENGTH_VALID_ERROR
} from "../src/processApplication/properties/index"

let $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

function subjectFactory() {
  return new Rx.Subject()
}

function makeDummyClickEvent({ value, attrs }) {
  return {
    preventDefault: noop,
    tap: x => console.log(x),
    target: {
      value: value,
      getAttribute: function makeDummyClickEvent_getAttribute(attrName) {
        return attrs[attrName]
      }
    }
  }
}

// NOTE : keys MUST be in that order... same order as in driver because JSON.stringify is no
// bijection
const mockUserAppParams = JSON.stringify({
  userKey: fakeUserKey,
  opportunityKey: fakeOpportunityKey,
});

// Test strategy
// We will strive as much as possible to test functionality rather than visual appearance.
// This means we will try not to compare HTML code, but search any suitable representation of the
// user interface for the corresponding functionality or feature. For instance, if we look for
// an error message, we will only search for the text of that message, not the location, the HTML
// element, or the font in which it is displayed.

// Specifications
// 1. No existing user application
QUnit.module("No existing user application", {});
// 1.1 Displays UI
// GIVEN there is no prior user application
// WHEN the user navigate to the page
// THEN it displays the About screen defined as
// - About you
// - Personal details
// - placeholder text for each input
// - Continue button
QUnit.test("Displays UI", function exec_test(assert) {
  let done = assert.async(2);
  const mockUserAppParams = JSON.stringify({
    userKey: fakeUserKey,
    opportunityKey: fakeOpportunityKey,
  });
  console.warn('user ap params', mockUserAppParams);

  const mockTeamsParams = JSON.stringify({ projectKey: fakeProjectKey });
  const mockOpportunityParams = JSON.stringify({ opportunityKey: fakeOpportunityKey });
  const mockProjectsParams = JSON.stringify({ projectKey: fakeProjectKey });
  const project = projects[[`${PROJECTS_REF}!${fakeProjectKey}`]];
  const opportunity = opportunities[`${OPPORTUNITY_REF}!${fakeOpportunityKey}`];

  const inputs = [
    { domainAction$: { diagram: '-----', values: {} } },
    { user$: { diagram: 'u----', values: { u: defaultUser } } },
    {
      [`DOM!${USER_APPLICATION_ABOUT_CONTINUE_BUTTON_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_QUESTION_CONTINUE_BUTTON_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_TEAM_CONTINUE_BUTTON_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_BACK_TO_TEAMS_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_SKIP_TEAM_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_JOIN_UNJOIN_TEAM_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_TEAMLIST_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_ABOUT_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_OPP_QUESTION_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_TEAMS_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_SUBMIT_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_SUPERPOWER_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_LEGAL_NAME_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_PREFERRED_NAME_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_PHONE_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_BIRTHDAY_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_ZIPCODE_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_OPP_ANSWER_SELECTOR}`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_TEAM_ANSWER_SELECTOR}`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`domainQuery!${mockUserAppParams}@${USER_APPLICATION}`]: {
        diagram: 'u----', values: { u: null }
      }
    },
    {
      [`domainQuery!${mockTeamsParams}@${TEAMS}`]: {
        diagram: 'v----', values: { v: teams[`${TEAMS_REF}!${fakeProjectKey}`] }
      }
    },
    {
      [`domainQuery!${mockOpportunityParams}@${OPPORTUNITY}`]: {
        diagram: 'u----', values: { u: opportunities[`${OPPORTUNITY_REF}!${fakeOpportunityKey}`] }
      }
    },
    {
      [`domainQuery!${mockProjectsParams}@${PROJECTS}`]: {
        diagram: 'u----', values: { u: projects[`${PROJECTS_REF}!${fakeProjectKey}`] }
      }
    },
  ];

  const testResults = {
    DOM: {
      outputs: [
        LOADING_USER_APPLICATION_DATA,
        [
          project.name,
          project.date,
          `${COMPLETE_YOUR_APPLICATION_FOR} ${project.name}`,
          STEP_ABOUT, STEP_QUESTION, STEP_TEAMS, STEP_REVIEW,
          ABOUT_YOU, PERSONAL_DETAILS, CONTINUE
        ].join("")
      ],
      successMessage: 'Displays expected project details and necessary inputs',
      transform: pipe(convertVNodesToHTML, stripHtmlTags)
    },
    domainAction$: {
      outputs: [],
      successMessage: 'As expected, starting the application process does not generate any' +
      ' domain action',
    },
  };

  runTestScenario(inputs, testResults, ProcessApplication, {
    tickDuration: 5,
    waitForFinishDelay: 20,
    analyzeTestResults: analyzeTestResults(assert, done),
    mocks: {
      DOM: makeMockDOMSource,
      document: makeMockDocumentSource,
      domainQuery: makeDomainQuerySource
    },
    sourceFactory: {
      [`DOM!${USER_APPLICATION_ABOUT_CONTINUE_BUTTON_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_QUESTION_CONTINUE_BUTTON_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_TEAM_CONTINUE_BUTTON_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_BACK_TO_TEAMS_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_SKIP_TEAM_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_JOIN_UNJOIN_TEAM_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_TEAMLIST_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_ABOUT_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_OPP_QUESTION_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_TEAMS_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_SUBMIT_SELECTOR}@click`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_SUPERPOWER_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_LEGAL_NAME_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_PREFERRED_NAME_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_PHONE_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_BIRTHDAY_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_ZIPCODE_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_OPP_ANSWER_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_TEAM_ANSWER_SELECTOR}`]: subjectFactory,
      // TODO : test that with a replay subject instead of normal subject
      // TODO : add test for replay subjects in runTestScenario
      [`domainQuery!${mockUserAppParams}@${USER_APPLICATION}`]: subjectFactory,
      [`domainQuery!${mockTeamsParams}@${TEAMS}`]: subjectFactory,
      [`domainQuery!${mockOpportunityParams}@${OPPORTUNITY}`]: subjectFactory,
      [`domainQuery!${mockProjectsParams}@${PROJECTS}`]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });

});
// 1.2 Displays field validation messages
// WHEN the user has not filled in any ABOUT screen field
// WHEN the user click `Continue` button
// THEN it displays the relevant error messages
QUnit.test("Displays field validation messages", function exec_test(assert) {
  let done = assert.async(2);
  const mockTeamsParams = JSON.stringify({ projectKey: fakeProjectKey });
  const mockOpportunityParams = JSON.stringify({ opportunityKey: fakeOpportunityKey });
  const mockProjectsParams = JSON.stringify({ projectKey: fakeProjectKey });
  const project = projects[[`${PROJECTS_REF}!${fakeProjectKey}`]];
  const opportunity = opportunities[`${OPPORTUNITY_REF}!${fakeOpportunityKey}`];

  // NOTE :
  // Domain query stream can sometimes have to be memoized streams. Here that is not necessary
  // for two reasons :
  // 1. The code makes use of combineLatest which already memoizes the input streams
  // 2. The code also is interested only in the first value for each of those streams, so there
  // is really no need to memoize here
  // However, it is important to keep in mind that this does not generalize to other cases, and
  // constant care must be given to whether one is handling events or behaviours.
  // NOTE :
  // Err on the side of security and predictability by sending the click event on the next tick
  // after all domain values have been set up. For instance, here, sending the click event on
  // the same tick and before the domain values initialization would fail the test.
  const inputs = [
    { domainAction$: { diagram: '-----', values: {} } },
    { user$: { diagram: 'u----', values: { u: defaultUser } } },
    {
      [`DOM!${USER_APPLICATION_ABOUT_CONTINUE_BUTTON_SELECTOR}@click`]: {
        diagram: '-c---', values: {
          c: makeDummyClickEvent({})
        }
      }
    },
    {
      [`DOM!${USER_APPLICATION_QUESTION_CONTINUE_BUTTON_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_TEAM_CONTINUE_BUTTON_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_BACK_TO_TEAMS_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_SKIP_TEAM_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_JOIN_UNJOIN_TEAM_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_TEAMLIST_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_ABOUT_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_OPP_QUESTION_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_TEAMS_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`DOM!${USER_APPLICATION_REVIEW_SUBMIT_SELECTOR}@click`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_SUPERPOWER_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_LEGAL_NAME_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_PREFERRED_NAME_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_PHONE_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_BIRTHDAY_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_ZIPCODE_SELECTOR}`]: {
        diagram: 'u----', values: {u: ""}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_OPP_ANSWER_SELECTOR}`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`document!value@${USER_APPLICATION_FORM_INPUT_TEAM_ANSWER_SELECTOR}`]: {
        diagram: '-----', values: {}
      }
    },
    {
      [`domainQuery!${mockUserAppParams}@${USER_APPLICATION}`]: {
        diagram: 'u----', values: { u: null }
      }
    },
    {
      [`domainQuery!${mockTeamsParams}@${TEAMS}`]: {
        diagram: 'v----', values: { v: teams[`${TEAMS_REF}!${fakeProjectKey}`] }
      }
    },
    {
      [`domainQuery!${mockOpportunityParams}@${OPPORTUNITY}`]: {
        diagram: 'u----', values: { u: opportunities[`${OPPORTUNITY_REF}!${fakeOpportunityKey}`] }
      }
    },
    {
      [`domainQuery!${mockProjectsParams}@${PROJECTS}`]: {
        diagram: 'u----', values: { u: projects[`${PROJECTS_REF}!${fakeProjectKey}`] }
      }
    },
  ];

  const testResults = {
    DOM: {
      outputs: [
        LOADING_USER_APPLICATION_DATA,
        [
          project.name,
          project.date,
          `${COMPLETE_YOUR_APPLICATION_FOR} ${project.name}`,
          STEP_ABOUT, STEP_QUESTION, STEP_TEAMS, STEP_REVIEW,
          ABOUT_YOU, PERSONAL_DETAILS, CONTINUE
        ].join(""),
        [
          project.name,
          project.date,
          `${COMPLETE_YOUR_APPLICATION_FOR} ${project.name}`,
          STEP_ABOUT, STEP_QUESTION, STEP_TEAMS, STEP_REVIEW,
          ABOUT_YOU, MANDATORY_PLEASE_FILL_IN_VALID_ERROR,
          PERSONAL_DETAILS, MANDATORY_PLEASE_FILL_IN_VALID_ERROR, MANDATORY_PLEASE_FILL_IN_VALID_ERROR, MIN_LENGTH_VALID_ERROR, MIN_LENGTH_VALID_ERROR, MIN_LENGTH_VALID_ERROR,
          CONTINUE
        ].join("")
      ],
      successMessage: 'Displays expected project details and necessary inputs',
      transform: pipe(convertVNodesToHTML, stripHtmlTags)
    },
    domainAction$: {
      outputs: [],
      successMessage: 'As expected, starting the application process does not generate any' +
      ' domain action',
    },
  };

  runTestScenario(inputs, testResults, ProcessApplication, {
    tickDuration: 5,
    waitForFinishDelay: 20,
    analyzeTestResults: analyzeTestResults(assert, done),
    mocks: {
      DOM: makeMockDOMSource,
      document: makeMockDocumentSource,
      domainQuery: makeDomainQuerySource
    },
    sourceFactory: {
      [`DOM!${USER_APPLICATION_ABOUT_CONTINUE_BUTTON_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_QUESTION_CONTINUE_BUTTON_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_TEAM_CONTINUE_BUTTON_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_BACK_TO_TEAMS_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_SKIP_TEAM_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_JOIN_UNJOIN_TEAM_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_TEAMLIST_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_ABOUT_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_OPP_QUESTION_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_TEAMS_SELECTOR}@click`]: subjectFactory,
      [`DOM!${USER_APPLICATION_REVIEW_SUBMIT_SELECTOR}@click`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_SUPERPOWER_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_LEGAL_NAME_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_PREFERRED_NAME_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_PHONE_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_BIRTHDAY_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_ZIPCODE_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_OPP_ANSWER_SELECTOR}`]: subjectFactory,
      [`document!value@${USER_APPLICATION_FORM_INPUT_TEAM_ANSWER_SELECTOR}`]: subjectFactory,
      [`domainQuery!${mockUserAppParams}@${USER_APPLICATION}`]: subjectFactory,
      [`domainQuery!${mockTeamsParams}@${TEAMS}`]: subjectFactory,
      [`domainQuery!${mockOpportunityParams}@${OPPORTUNITY}`]: subjectFactory,
      [`domainQuery!${mockProjectsParams}@${PROJECTS}`]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });

});
// 1.3 Moves to QUESTION step
// WHEN the user fills correctly all ABOUT screen fields
// WHEN the user click `Continue` button
// THEN it saves the field data
// THEN it displays the QUESTION screen with empty fields
// 1.4 Moves to TEAMS step
// WHEN the user fills correctly all QUESTION screen fields
// WHEN the user click `Continue` button
// THEN it saves the field data
// THEN it displays the TEAMS screen with no teams having been joined
// 1.5 Moves to TEAM DETAIL step
// WHEN the user clicks on one team in TEAMS screen fields
// THEN it displays the TEAM DETAIL screen for that team, with status not joined
// 1.6 Moves back to TEAMS step
// WHEN the user clicks on back to teams button in TEAM DETAIL screen
// THEN it displays the TEAMS screen with no teams having been joined
// 1.7 Joins a team and back
// WHEN the user clicks on one team in TEAMS screen fields
// WHEN the user clicks on join team button
// WHEN the user clicks on back to teams button
// THEN it displays the TEAM DETAIL screen for the next team (unjoined)
// THEN it displays the TEAMS screen
// THEN the joined team appears visually as joined
// 1.8 Unjoins a team and back
// WHEN the user clicks on the previously joined team in TEAMS screen fields
// THEN it displays the TEAM DETAIL screen for that team (joined) with unjoin button
// WHEN the user clicks on unjoin team button
// THEN it displays the TEAM DETAIL screen for the next team (unjoined)
// WHEN the user clicks on back to teams button
// THEN it displays the TEAMS screen
// THEN the joined team appears visually as unjoined
// 1.9 Moves to Review - cannot
// WHEN the user clicks on the continue button
// THEN an error message is displayed (must have joined one team to continue)
// 1.9 Moves to Review - can
// REPEAT 1.7
// WHEN the user clicks on the continue button
// THEN the REVIEW screen appears with the user info, the one team joined info, and question
// 1.10 Review - Edit About info and Continue
// WHEN the user edits the About info
// THEN the ABOUT screen appears with previously filled About info
// WHEN the user edits the About info
// WHEN the user clicks on Continue
// THEN the REVIEW screen appears with previously filled About info
// 1.11 Review - Edit Question info and Continue
// REPEAT 1.10 with question
// 1.12 Review - Edit Teams info and Continue
// WHEN the user edits the Teams info
// THEN the TEAMS screen appears with the joined team in the right visual state
// WHEN the user click on that team info
// THEN the TEAM DETAIL screen appears with the joined team in the right visual state
// WHEN the user click on unjoin button
// THEN the TEAM DETAIL screen switched to next team
// WHEN the user join that team
// THEN the TEAM DETAIL screen switched to next team
// WHEN the user click on back to teams
// THEN the TEAMS screen appears
// WHEN the user clicks on Continue button
// THEN the REVIEW screen appears
// 1.13 Apply
// WHEN the user clicks on Apply button
// THEN the APPLIED screen appears

// !! and that was only the case No existing user application...
// !! Also I did not test the skip button...

// TODO I AM HERE - FINISH THE LIST OF TESTS THEN WRITE THE TESTS

