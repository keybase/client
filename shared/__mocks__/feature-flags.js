// @flow

import type {FeatureFlags} from '../util/feature-flags.js.flow'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  chatIndexProfilingEnabled: false,
  foldersInProfileTab: true,
  identify3: true,
  moveOrCopy: true,
  newTeamBuildingForChat: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: true,
  plansEnabled: false,
  useNewRouter: false,
  walletsEnabled: true,
}

console.warn('feature flag mock in effect')

export default ff
