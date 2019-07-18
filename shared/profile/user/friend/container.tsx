import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import Friend from '.'

type OwnProps = {
  username: string
  width: number
}

const mapStateToProps = (state, ownProps) => {
  return {
    fullname: state.users.infoMap.getIn([ownProps.username, 'fullname'], ''),
    username: ownProps.username,
  }
}
const mapDispatchToProps = dispatch => ({
  _onClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  fullname: stateProps.fullname,
  onClick: () => dispatchProps._onClick(stateProps.username),
  username: stateProps.username,
  width: ownProps.width,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Friend')(Friend)
