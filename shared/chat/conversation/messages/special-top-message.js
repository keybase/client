// @flow
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import CreateTeamNotice from './system-create-team-notice/container'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'
import shallowEqual from 'shallowequal'
import {Text, Box, Icon} from '../../../common-adapters'
import {compose, setDisplayName, connect, type TypedState} from '../../../util/container'
import {globalStyles, globalMargins, isMobile} from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  hasOlderResetConversation: boolean,
  showRetentionNotice: boolean,
  loadMoreType: 'moreToLoad' | 'noMoreToLoad',
  showTeamOffer: boolean,
  measure: ?() => void,
}

class TopMessage extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    if (this.props.measure && !shallowEqual(this.props, prevProps)) {
      this.props.measure()
    }
  }

  render() {
    return (
      <Box>
        {this.props.loadMoreType === 'noMoreToLoad' &&
          this.props.showRetentionNotice && (
            <RetentionNotice conversationIDKey={this.props.conversationIDKey} measure={this.props.measure} />
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
  measure: ?() => void,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const hasLoadedEver = state.chat2.messageOrdinals.get(ownProps.conversationIDKey) !== undefined
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  const loadMoreType = state.chat2.moreToLoadMap.get(ownProps.conversationIDKey)
    ? 'moreToLoad'
    : 'noMoreToLoad'
  const showTeamOffer =
    hasLoadedEver &&
    loadMoreType === 'noMoreToLoad' &&
    meta.teamType === 'adhoc' &&
    meta.participants.size > 2
  const hasOlderResetConversation = meta.supersedes !== Constants.noConversationIDKey
  // don't show default header in the case of the retention notice being visible
  const showRetentionNotice =
    hasLoadedEver &&
    meta.retentionPolicy.type !== 'retain' &&
    !(meta.retentionPolicy.type === 'inherit' && meta.teamRetentionPolicy.type === 'retain')
  return {
    conversationIDKey: ownProps.conversationIDKey,
    hasOlderResetConversation,
    loadMoreType,
    showRetentionNotice,
    showTeamOffer,
  }
}
const mapDispatchToProps = (dispatch: Dispatch) => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure: ownProps.measure,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('TopMessage')
)(TopMessage)
