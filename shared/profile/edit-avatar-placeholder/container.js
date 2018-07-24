// @flow
import EditAvatar from '.'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  const username = state.config.username
  if (!username) {
    throw new Error('Not logged in')
  }

  const trackerState = username && state.tracker.userTrackers[username]
  const userProofs = trackerState && trackerState.proofs
  const hasAvatarProof = userProofs && userProofs.some(p => p.type === 'github' || p.type === 'twitter')
  return {
    keybaseUsername: username,
    hasAvatar: hasAvatarProof,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAck: () => dispatch(navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(EditAvatar)
