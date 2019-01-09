// @flow
import * as UsersGen from './users-gen'
import * as SettingsGen from './settings-gen'
import * as ConfigGen from './config-gen'
import * as TrackerConstants from '../constants/tracker'
import * as TrackerGen from './tracker-gen'
import * as Saga from '../util/saga'
import engine from '../engine'

const updateProofState = (state, action) => {
  const {username} = action.payload

  const user = state.tracker.userTrackers[username]
  if (!user) {
    return
  }
  const proofsGeneralState = TrackerConstants.overviewStateOfProofs(user.proofs)
  const simpleProofState = TrackerConstants.deriveSimpleProofState(user.eldestKidChanged, proofsGeneralState)

  // This is kinda crappy but needs tracker to be cleaned up. If you refollow / local track your state stays 'warning' but your
  // lastState is 'followed'
  const isRed =
    ['warning', 'error', 'revoked'].includes(simpleProofState) &&
    !['followed', 'refollowed'].includes(user.lastAction)

  if (isRed) {
    return UsersGen.createUpdateBrokenState({
      newlyBroken: [username],
      newlyFixed: [],
    })
  } else {
    return UsersGen.createUpdateBrokenState({
      newlyBroken: [],
      newlyFixed: [username],
    })
  }
}

const setupEngineListeners = () => {
  engine().setIncomingCallMap({
    'keybase.1.NotifyUsers.passwordChanged': () =>
      Saga.callUntyped(function*() {
        // Mark that we are not randomPW anymore if we got a passphrase change.
        yield Saga.put(SettingsGen.createLoadedHasRandomPw({randomPW: false}))
      }),
  })
}

function* usersSaga(): Saga.SagaGenerator<any, any> {
  // Temporary until tracker gets refactored a bit. Listen for proof updates and update our broken state
  yield* Saga.chainAction<TrackerGen.UpdateProofStatePayload>(TrackerGen.updateProofState, updateProofState)

  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
}

export default usersSaga
