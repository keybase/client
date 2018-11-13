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
        fromTracker: true,
        newlyBroken: [username],
        newlyFixed: [],
      })
    )
  } else {
    return Saga.put(
      UsersGen.createUpdateBrokenState({
        fromTracker: true,
        newlyBroken: [],
        newlyFixed: [username],
      })
    )
  }
}

const updateBrokenState = (state: TypedState, action: UsersGen.UpdateBrokenStatePayload) =>
  !action.payload.fromTracker &&
  Saga.all(
    action.payload.newlyBroken
      .concat(action.payload.newlyFixed)
      .map(u => Saga.put(TrackerGen.createGetProfile({username: u})))
  )

function* usersSaga(): Saga.SagaGenerator<any, any> {
  // Temporary until tracker gets refactored a bit. Listen for proof updates and update our broken state
  yield Saga.safeTakeEveryPure(TrackerGen.updateProofState, updateProofState)
  yield Saga.actionToAction(UsersGen.updateBrokenState, updateBrokenState)
}

export default usersSaga
