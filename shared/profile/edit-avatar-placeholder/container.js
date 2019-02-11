// @flow
import EditAvatar from '.'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

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
    hasAvatar: hasAvatarProof,
    keybaseUsername: username,
  }
}

const mapDispatchToProps = dispatch => ({
  onAck: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(EditAvatar)
