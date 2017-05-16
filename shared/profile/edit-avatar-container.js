// @flow
import EditAvatar from './edit-avatar'
import {TypedConnector} from '../util/typed-connect'
import {navigateUp} from '../actions/route-tree'

import type {Props} from './edit-avatar'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  const username = state.config.username
  if (!username) {
    throw new Error('Not logged in')
  }

  const trackerState = username && state.tracker.trackers[username]
  const userProofs = trackerState && trackerState.type === 'tracker' && trackerState.proofs
  const hasAvatarProof = userProofs && userProofs.some(p => p.type === 'github' || p.type === 'twitter')
  return {
    keybaseUsername: username,
    hasAvatar: hasAvatarProof,
    onAck: () => {
      dispatch(navigateUp())
    },
  }
})(EditAvatar)
