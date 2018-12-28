// @flow
import * as Container from '../../util/container'
import Tracker from './index.desktop'
import * as Constants from '../../constants/profile2'

type OwnProps = {|
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = state.profile2.usernameToDetails.get(ownProps.username, Constants.noDetails)
  return {
    _assertions: d.assertions,
    bio: d.bio,
    followThem: d.followThem,
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: d.followsYou,
    guiID: d.guiID,
    location: d.location,
    publishedTeams: d.publishedTeams,
    reason: d.reason,
  }
}
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const map = (stateProps._assertions || []).reduce((map, a) => {
    if (!map[a.state]) {
      map[a.state] = 0
    }
    map[a.state]++
    return map
  }, {})

  let state
  if (map.error) {
    state = 'error'
  } else if (map.checking) {
    state = 'checking'
  } else {
    state = 'valid'
  }

  return {
    assertions: stateProps._assertions ? stateProps._assertions.keySeq().toArray() : null,
    bio: stateProps.bio,
    followThem: stateProps.followThem,
    followersCount: stateProps.followersCount,
    followingCount: stateProps.followingCount,
    followsYou: stateProps.followsYou,
    guiID: stateProps.guiID,
    location: stateProps.location,
    publishedTeams: stateProps.publishedTeams,
    username: ownProps.username,
    reason: stateProps.reason,
    state,
  }
}

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Tracker2'
)(Tracker)
