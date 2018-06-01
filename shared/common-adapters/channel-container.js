// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel} from './channel'
import {connect, compose, setDisplayName, type TypedState, type Dispatch} from '../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {convID, name}) => ({
  onClick: () =>
    dispatch(
      Chat2Gen.createSelectOrPreviewTeamConversation({
        conversationIDKey: convID,
        channelname: name,
        reason: 'messageLink',
      })
    ),
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('Channel'))(Channel)
