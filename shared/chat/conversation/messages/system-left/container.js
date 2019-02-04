// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import Joined from '.'
import {connect} from '../../../../util/container'

type OwnProps = {|
  message: Types.MessageSystemLeft,
|}

const mapStateToProps = (state, {message}) => {
  const meta = Constants.getMeta(state, message.conversationIDKey)
  return {
    channelname: meta.channelname,
    isBigTeam: meta.teamType === 'big',
    teamname: meta.teamname,
  }
}

const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => stateProps

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Joined)
