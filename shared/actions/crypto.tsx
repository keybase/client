// import * as Container from '../util/container'
// import * as Constants from '../constants/crypto'
// import * as ConfigConstants from '../constants/config'
// import * as TeamBuildingGen from './team-building-gen'
// import {commonListenActions, filterForNs} from './team-building'

// Get list of users from crypto TeamBuilding for encrypt operation
// const onSetRecipients = (state: Container.TypedState) => {
//   const currentUser = ConfigConstants.useCurrentUserState.getState().username
//   const s = Constants.useState.getState()
//   const {options} = s.encrypt

//   const users = [...state.crypto.teamBuilding.finishedTeam]
//   let hasSBS = false
//   const usernames = users.map(user => {
//     // If we're encrypting to service account that is not proven on keybase set
//     // (SBS) then we *must* encrypt to ourselves
//     if (user.serviceId == 'email') {
//       hasSBS = true
//       return `[${user.username}]@email`
//     }
//     if (user.serviceId !== 'keybase') {
//       hasSBS = true
//       return `${user.username}@${user.serviceId}`
//     }
//     return user.username
//   })

//   // User set themselves as a recipient, so don't show 'includeSelf' option
//   // However we don't want to set hideIncludeSelf if we are also encrypting to an SBS user (since we must force includeSelf)
//   if (usernames.includes(currentUser) && !hasSBS) {
//     s.dispatch.setEncryptOptions(options, true)
//   }

//   s.dispatch.setRecipients(usernames, hasSBS)
// }

const initCrypto = () => {
  // TODO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // commonListenActions('crypto')
  // This action is used to hook into the TeamBuildingGen.finishedTeamBuilding action.
  // We want this so that we can figure out which user(s) have been selected and pass that result over to store.crypto.encrypt.recipients
  // Container.listenAction(TeamBuildingGen.finishedTeamBuilding, filterForNs('crypto', onSetRecipients))
}

export default initCrypto
