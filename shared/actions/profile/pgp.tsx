import * as Container from '../../util/container'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import {RPCError} from '../../util/errors'
import {peopleTab} from '../../constants/tabs'

const generatePgp = async (state: Container.TypedState, _a: unknown, listenerApi: Container.ListenerApi) => {
  let canceled = false

  const ids = [state.profile.pgpEmail1, state.profile.pgpEmail2, state.profile.pgpEmail3]
    .filter(Boolean)
    .map(email => ({
      comment: '',
      email: email || '',
      username: state.profile.pgpFullName || '',
    }))

  listenerApi.dispatch(
    RouteTreeGen.createNavigateAppend({
      path: [peopleTab, 'profile', 'profilePgp', 'profileProvideInfo', 'profileGenerate'],
    })
  )
  // We allow the UI to cancel this call. Just stash this intention and nav away and response with an error to the rpc
  const cancelTask = listenerApi.fork(async () => {
    await listenerApi.take(action => action.type === ProfileGen.cancelPgpGen)
    canceled = true
  })

  try {
    await RPCTypes.pgpPgpKeyGenDefaultRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.pgpUi.keyGenerated': ({key}, response) => {
            if (canceled) {
              response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
              return undefined
            } else {
              response.result()
              return ProfileGen.createUpdatePgpPublicKey({publicKey: key.key})
            }
          },
          'keybase.1.pgpUi.shouldPushPrivate': async ({prompt}, response) => {
            listenerApi.dispatch(
              RouteTreeGen.createNavigateAppend({
                path: [
                  peopleTab,
                  'profile',
                  'profilePgp',
                  'profileProvideInfo',
                  'profileGenerate',
                  'profileFinished',
                ],
              })
            )
            listenerApi.dispatch(
              ProfileGen.createUpdatePromptShouldStoreKeyOnServer({promptShouldStoreKeyOnServer: prompt})
            )
            const [action] = await listenerApi.take<ProfileGen.FinishedWithKeyGenPayload>(
              action => action.type === ProfileGen.finishedWithKeyGen
            )
            response.result(action.payload.shouldStoreKeyOnServer)
          },
        },
        incomingCallMap: {'keybase.1.pgpUi.finished': () => {}},
        params: {createUids: {ids, useDefault: false}},
      },
      listenerApi
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // did we cancel?
    if (error.code !== RPCTypes.StatusCode.scinputcanceled) {
      throw error
    }
  }
  cancelTask.cancel()
}

export const initPgp = () => {
  Container.listenAction(ProfileGen.generatePgp, generatePgp)
}
