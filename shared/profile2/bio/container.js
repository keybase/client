// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile2'
import Bio from '.'

type OwnProps = {|
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = state.profile2.usernameToDetails.get(ownProps.username, Constants.noDetails)
  return {
    bio: d.bio,
    followThem: d.followThem,
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: d.followsYou,
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
  location: stateProps.location,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Bio'
)(Bio)
