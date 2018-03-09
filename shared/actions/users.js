// @flow
import * as UsersGen from './users-gen'
import * as TrackerConstants from '../constants/tracker'
import * as TrackerGen from './tracker-gen'
import type {TypedState} from '../util/container'
import * as Saga from '../util/saga'

const updateProofState = (action: TrackerGen.UpdateProofStatePayload, state: TypedState) => {
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
    return Saga.put(
      UsersGen.createUpdateBrokenState({
        newlyBroken: [username],
        newlyFixed: [],
      })
    )
  } else {
    return Saga.put(
      UsersGen.createUpdateBrokenState({
        newlyBroken: [],
        newlyFixed: [username],
      })
    )
  }
}

function* usersSaga(): Saga.SagaGenerator<any, any> {
  // Temporary until tracker gets refactored a bit. Listen for proof updates and update our broken state
  yield Saga.safeTakeEveryPure(TrackerGen.updateProofState, updateProofState)
}

export default usersSaga
