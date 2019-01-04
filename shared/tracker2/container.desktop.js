// @flow
// Only used for storybook, maybe get rid of this
import * as Container from '../util/container'
import Tracker from './index.desktop'
import * as Constants from '../constants/tracker2'

type OwnProps = {|
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = state.tracker2.usernameToDetails.get(ownProps.username, Constants.noDetails)
  return {
    _assertions: d.assertions,
    _teamShowcase: d.teamShowcase,
    bio: d.bio,
    followThem: Constants.followThem(state, ownProps.username),
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: Constants.followsYou(state, ownProps.username),
    guiID: d.guiID,
    location: d.location,
    reason: d.reason,
    state: d.state,
  }
}
const mapDispatchToProps = dispatch => ({
  onAccept: () => {},
  onChat: () => {},
  onClose: () => {},
  onFollow: () => {},
  onIgnoreFor24Hours: () => {},
  onReload: () => {},
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps._assertions ? stateProps._assertions.keySeq().toArray() : null,
  bio: stateProps.bio,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  guiID: stateProps.guiID,
  location: stateProps.location,
  onAccept: dispatchProps.onAccept,
  onChat: dispatchProps.onChat,
  onClose: dispatchProps.onClose,
  onFollow: dispatchProps.onFollow,
  onIgnoreFor24Hours: dispatchProps.onIgnoreFor24Hours,
  onReload: dispatchProps.onReload,
  reason: stateProps.reason,
  state: stateProps.state,
  teamShowcase: stateProps._teamShowcase ? stateProps._teamShowcase.map(t => t.toObject()).toArray() : null,
  username: ownProps.username,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Tracker2'
)(Tracker)
