// @flow
import {FilterBigTeamChannel} from '.'
import * as Route from '../../../../actions/route-tree'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {connect, isMobile} from '../../../../util/container'

const mapStateToProps = (_, {teamname, channelname}) => ({
  channelname,
  teamname,
})

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true}))
    if (isMobile) {
      dispatch(Route.navigateAppend(['conversation']))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname || '',
  onSelectConversation: dispatchProps.onSelectConversation,
  teamname: stateProps.teamname || '',
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterBigTeamChannel)
