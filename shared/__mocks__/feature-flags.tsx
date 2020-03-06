import {FeatureFlags} from '../util/feature-flags'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  connectThrashCheck: true,
  foldersInProfileTab: true,
  moveOrCopy: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  tabletSupport: false,
  teamInvites: false,
  teamsRedesign: true,
  webOfTrust: false,
  whyDidYouRender: false,
}

console.warn('feature flag mock in effect')

export default ff
