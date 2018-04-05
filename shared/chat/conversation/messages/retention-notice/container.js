// @flow
import {connect, type TypedState} from '../../../../util/container'
import * as ChatTypes from '../../../../constants/types/chat2'
import {getMeta} from '../../../../constants/chat2'
import RetentionNotice from '.'

type OwnProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const meta = getMeta(state, ownProps.conversationIDKey)
  return {
    policy: meta.retentionPolicy,
    teamPolicy: meta.teamRetentionPolicy,
    teamType: meta.teamType,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(RetentionNotice)
