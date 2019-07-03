import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import CreateTeamNotice from './system-create-team-notice/container'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'
import shallowEqual from 'shallowequal'
import * as Kb from '../../../common-adapters'
import {namedConnect} from '../../../util/container'
import {globalStyles, globalMargins, isMobile} from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  hasOlderResetConversation: boolean
  showRetentionNotice: boolean
  loadMoreType: 'moreToLoad' | 'noMoreToLoad'
  showTeamOffer: boolean
  measure: (() => void) | null
  pendingWaiting: boolean
}

class TopMessage extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    if (this.props.measure && !shallowEqual(this.props, prevProps)) {
      this.props.measure()
    }
  }

  render() {
    return (
      <Kb.Box>
        {this.props.loadMoreType === 'noMoreToLoad' && this.props.showRetentionNotice && (
          <RetentionNotice conversationIDKey={this.props.conversationIDKey} measure={this.props.measure} />
        )}
        <Kb.Box style={spacerStyle} />
        {this.props.hasOlderResetConversation && (
          <ProfileResetNotice conversationIDKey={this.props.conversationIDKey} />
        )}
        {this.props.pendingWaiting && (
          <Kb.Text type="BodySmallSemibold" style={loadingStyle}>
            Loading...
          </Kb.Text>
        )}
        {this.props.loadMoreType === 'noMoreToLoad' &&
          !this.props.showRetentionNotice &&
          !this.props.pendingWaiting && (
            <Kb.Box style={secureStyle}>
              <Kb.Icon type={isMobile ? 'icon-secure-static-266' : 'icon-secure-266'} />
            </Kb.Box>
          )}
        {this.props.showTeamOffer && (
          <Kb.Box style={moreStyle}>
            <CreateTeamNotice />
          </Kb.Box>
        )}
        {this.props.loadMoreType === 'moreToLoad' && (
          <Kb.Box style={moreStyle}>
            <Kb.Text type="BodySmallSemibold">ヽ(ಠ益ಠ)ノ</Kb.Text>
            <Kb.Text type="BodySmallSemibold">Digging ancient messages...</Kb.Text>
          </Kb.Box>
        )}
      </Kb.Box>
    )
  }
}

const loadingStyle = {
  marginLeft: globalMargins.small,
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
  conversationIDKey: Types.ConversationIDKey
  measure: (() => void) | null
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const hasLoadedEver = state.chat2.messageOrdinals.get(ownProps.conversationIDKey) !== undefined
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  const pendingWaiting = ownProps.conversationIDKey === Constants.pendingWaitingConversationIDKey
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
    measure: ownProps.measure,
    pendingWaiting,
    showRetentionNotice,
    showTeamOffer,
  }
}
const mapDispatchToProps = () => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...stateProps,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'TopMessage')(TopMessage) as any
