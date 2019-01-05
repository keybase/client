// @flow
import * as Container from '../../../util/container'
import Friend from '.'

type OwnProps = {|
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  return {
    followThem: state.config.following.has(ownProps.username),
    followsYou: state.config.followers.has(ownProps.username),
    fullname: state.users.infoMap.getIn([ownProps.username, 'fullname'], ''),
    username: ownProps.username,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  followThem: stateProps.followThem,
  followsYou: stateProps.followsYou,
  fullname: stateProps.fullname,
  username: stateProps.username,
  width: ownProps.width
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Friend'
)(Friend)
