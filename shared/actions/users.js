// @flow
import * as UsersGen from './users-gen'
import * as TrackerConstants from '../constants/tracker'
import * as TrackerGen from './tracker-gen'
import * as Saga from '../util/saga'

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

function* usersSaga(): Saga.SagaGenerator<any, any> {
  // Temporary until tracker gets refactored a bit. Listen for proof updates and update our broken state
  yield* Saga.chainAction<TrackerGen.UpdateProofStatePayload>(TrackerGen.updateProofState, updateProofState)
}

export default usersSaga
