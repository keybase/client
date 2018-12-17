// @flow

import type {FeatureFlags} from '../util/feature-flags.js.flow'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  chatIndexProfilingEnabled: false,
  foldersInProfileTab: true,
  kbfsChatIntegration: true,
  moveOrCopy: true,
  newTeamBuildingForChat: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: true,
  peopleAnnouncementsEnabled: true,
  plansEnabled: false,
  walletsEnabled: true,
}

console.warn('feature flag mock in effect')

export default ff
