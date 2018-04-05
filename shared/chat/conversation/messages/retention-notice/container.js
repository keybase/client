// @flow
import {connect, type TypedState} from '../../../../util/container'
import * as ChatTypes from '../../../../constants/types/chat2'
import RetentionNotice from '.'

type OwnProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ownProps

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(RetentionNotice)
