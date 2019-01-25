// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/tracker2'
import Bio from '.'

type OwnProps = {|
  inTracker: boolean,
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, ownProps.username)
  return {
    bio: d.bio,
    followThem: Constants.followThem(state, ownProps.username),
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: Constants.followsYou(state, ownProps.username),
    fullname: d.fullname,
    location: d.location,
  }
}
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bio: stateProps.bio,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  fullname: stateProps.fullname,
  inTracker: ownProps.inTracker,
  location: stateProps.location,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Bio'
)(Bio)
