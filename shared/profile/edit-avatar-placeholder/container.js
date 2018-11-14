// @flow
import EditAvatar from '.'
import {connect} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

type OwnProps = {||}

const mapStateToProps = state => {
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

const mapDispatchToProps = dispatch => ({
  onAck: () => dispatch(navigateUp()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(EditAvatar)
