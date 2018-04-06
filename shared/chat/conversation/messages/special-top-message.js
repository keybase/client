// @flow
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import CreateTeamNotice from './system-create-team-notice/container'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'
import {Text, Box, Icon} from '../../../common-adapters'
import {connect, type TypedState} from '../../../util/container'
import {globalStyles, globalMargins, isMobile} from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  hasOlderResetConversation: boolean,
  showRetentionNotice: boolean,
  loadMoreType: 'moreToLoad' | 'noMoreToLoad',
  onToggleInfoPanel: () => void,
  showTeamOffer: boolean,
  // $FlowIssue "null or undefined is incompatible with null or undefined"
  measure: ?() => void,
}

class TopMessage extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    // remeasure if the layout changes. On purpose we don't change size when loadMoreType changes
    if (
      this.props.measure &&
      (this.props.hasOlderResetConversation !== prevProps.hasOlderResetConversation ||
        this.props.showTeamOffer !== prevProps.showTeamOffer)
    ) {
      this.props.measure()
    }
  }

  render() {
    return (
      <Box>
        {this.props.loadMoreType === 'noMoreToLoad' &&
          this.props.showRetentionNotice && (
            <RetentionNotice
              onToggleInfoPanel={this.props.onToggleInfoPanel}
              conversationIDKey={this.props.conversationIDKey}
              measure={this.props.measure}
            />
          )}
        <Box style={spacerStyle} />
        {this.props.hasOlderResetConversation && (
          <ProfileResetNotice conversationIDKey={this.props.conversationIDKey} />
        )}
        {this.props.loadMoreType === 'noMoreToLoad' &&
          !this.props.showRetentionNotice && (
            <Box style={secureStyle}>
              <Icon type={isMobile ? 'icon-secure-static-266' : 'icon-secure-266'} />
            </Box>
          )}
        {this.props.showTeamOffer && (
          <Box style={moreStyle}>
            <CreateTeamNotice />
          </Box>
        )}
        {this.props.loadMoreType === 'moreToLoad' && (
          <Box style={moreStyle}>
            <Text type="BodySmallSemibold">ヽ(ಠ益ಠ)ノ</Text>
            <Text type="BodySmallSemibold">Digging ancient messages...</Text>
          </Box>
        )}
      </Box>
    )
  }
}

const spacerStyle = {
  height: globalMargins.small,
}

const secureStyle = {
  ...globalStyles.flexBoxCenter,
  height: 116,
}

const moreStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  // TODO DESKTOP-6256 get rid of this
  onToggleInfoPanel: () => void,
  measure: ?() => void,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  const loadMoreType = meta.paginationKey ? 'moreToLoad' : 'noMoreToLoad'
  const showTeamOffer = meta.teamType === 'adhoc' && meta.participants.size > 2
  const hasOlderResetConversation = !!meta.supersedes
  // don't show default header in the case of the retention notice being visible
  const showRetentionNotice =
    meta.retentionPolicy.type !== 'retain' &&
    !(meta.retentionPolicy.type === 'inherit' && meta.teamRetentionPolicy.type === 'retain')
  return {
    conversationIDKey: ownProps.conversationIDKey,
    hasOlderResetConversation,
    onToggleInfoPanel: ownProps.onToggleInfoPanel,
    showRetentionNotice,
    loadMoreType,
    showTeamOffer,
  }
}
const mapDispatchToProps = (dispatch: Dispatch) => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure: ownProps.measure,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TopMessage)
