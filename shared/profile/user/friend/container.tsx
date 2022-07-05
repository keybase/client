import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import Friend from '.'

type OwnProps = {
  username: string
  width: number
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => ({
    fullname: (state.users.infoMap.get(ownProps.username) || {fullname: ''}).fullname,
    username: ownProps.username,
  }),
  dispatch => ({_onClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username}))}),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    fullname: stateProps.fullname || '',
    onClick: () => dispatchProps._onClick(stateProps.username),
    username: stateProps.username,
    width: ownProps.width,
  }),
  'Friend'
)(Friend)
