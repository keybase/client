// import * as Container from '../../util/container'
// import * as Constants from '../../constants/profile'
// import * as ProfileGen from '../profile-gen'
// import * as RPCTypes from '../../constants/types/rpc-gen'
// import * as ConfigConstants from '../../constants/config'
// import * as RouteTreeGen from '../route-tree-gen'
// import {RPCError} from '../../util/errors'
// import {peopleTab} from '../../constants/tabs'

// const generatePgp = async (_: unknown, _a: unknown, listenerApi: Container.ListenerApi) => {
//   let canceled = false

//   const {pgpEmail1, pgpEmail2, pgpEmail3, pgpFullName} = Constants.useState.getState()

//   const ids = [pgpEmail1, pgpEmail2, pgpEmail3].filter(Boolean).map(email => ({
//     comment: '',
//     email: email || '',
//     username: pgpFullName || '',
//   }))

//   const username = ConfigConstants.useCurrentUserState.getState().username
//   listenerApi.dispatch(
//     RouteTreeGen.createNavigateAppend({
//       path: [
//         peopleTab,
//         {props: {username}, selected: 'profile'},
//         'profilePgp',
//         'profileProvideInfo',
//         'profileGenerate',
//       ],
//     })
//   )
//   // We allow the UI to cancel this call. Just stash this intention and nav away and response with an error to the rpc
//   const cancelTask = listenerApi.fork(async () => {
//     await listenerApi.take(action => action.type === ProfileGen.cancelPgpGen)
//     canceled = true
//   })

//   try {
//     await RPCTypes.pgpPgpKeyGenDefaultRpcListener(
//       {
//         customResponseIncomingCallMap: {
//           'keybase.1.pgpUi.keyGenerated': ({key}, response) => {
//             if (canceled) {
//               response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
//             } else {
//               response.result()
//               Constants.useState.getState().dispatch.updatePgpPublicKey(key.key)
//             }
//           },
//           'keybase.1.pgpUi.shouldPushPrivate': async ({prompt}, response) => {
//             listenerApi.dispatch(
//               RouteTreeGen.createNavigateAppend({
//                 path: [
//                   peopleTab,
//                   {props: {username}, selected: 'profile'},
//                   'profilePgp',
//                   'profileProvideInfo',
//                   'profileGenerate',
//                   'profileFinished',
//                 ],
//               })
//             )
//             listenerApi.dispatch(
//               ProfileGen.createUpdatePromptShouldStoreKeyOnServer({promptShouldStoreKeyOnServer: prompt})
//             )
//             const [action] = await listenerApi.take<ProfileGen.FinishedWithKeyGenPayload>(
//               action => action.type === ProfileGen.finishedWithKeyGen
//             )
//             response.result(action.payload.shouldStoreKeyOnServer)
//           },
//         },
//         incomingCallMap: {'keybase.1.pgpUi.finished': () => {}},
//         params: {createUids: {ids, useDefault: false}},
//       },
//       listenerApi
//     )
//   } catch (error) {
//     if (!(error instanceof RPCError)) {
//       return
//     }
//     // did we cancel?
//     if (error.code !== RPCTypes.StatusCode.scinputcanceled) {
//       throw error
//     }
//   }
//   cancelTask.cancel()
// }

export const initPgp = () => {
  // TODO
  // Container.listenAction(ProfileGen.generatePgp, generatePgp)
}
