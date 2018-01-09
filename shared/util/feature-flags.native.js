// @flow

import type {FeatureFlags} from './feature-flags'

const ff: FeatureFlags = {
  admin: __DEV__,
  newPeopleTab: false,
  plansEnabled: false,
  tabPeopleEnabled: false,
  teamChatEnabled: true,
  tabGitEnabled: true,
  impTeamChatEnabled: false,
}

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
