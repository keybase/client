// @flow
import {FilterBigTeamChannel} from '.'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {connect} from '../../../../util/container'

const mapStateToProps = (_, {teamname, channelname}) => ({
  channelname,
  teamname,
})

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname || '',
  onSelectConversation: dispatchProps.onSelectConversation,
  teamname: stateProps.teamname || '',
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterBigTeamChannel)
