// @flow

import type {FeatureFlags} from '../util/feature-flags.js.flow'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const ff: FeatureFlags = {
  admin: false,
  airdrop: true,
  chatIndexProfilingEnabled: false,
  dbCleanEnabled: false,
  enableDeleteFolder: false,
  folderViewFilter: true,
  foldersInProfileTab: true,
  kbfsOfflineMode: true,
  moveOrCopy: true,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: true,
  plansEnabled: false,
  proofProviders: true,
  sendAttachmentToChat: true,
  useNewRouter: false,
}

console.warn('feature flag mock in effect')

export default ff
