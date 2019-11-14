import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import CreateTeamNotice from './system-create-team-notice/container'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'
import shallowEqual from 'shallowequal'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import NewChatCard from './cards/new-chat'
import HelloBotCard from './cards/hello-bot'
import MakeTeamCard from './cards/make-team'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  measure: (() => void) | null
}

type Props = {
  conversationIDKey: Types.ConversationIDKey
  createConversationError: string | null
  hasOlderResetConversation: boolean
  isHelloBotConversation: boolean
  loadMoreType: 'moreToLoad' | 'noMoreToLoad'
  measure: (() => void) | null
  pendingState: 'waiting' | 'error' | 'done'
  showRetentionNotice: boolean
  showTeamOffer: boolean
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
        <Kb.Box style={styles.spacer} />
        {this.props.hasOlderResetConversation && (
          <ProfileResetNotice conversationIDKey={this.props.conversationIDKey} />
        )}
        {this.props.pendingState === 'waiting' && (
          <Kb.Text type="BodySmallSemibold" style={styles.loading}>
            Loading...
          </Kb.Text>
        )}
        {this.props.pendingState === 'error' && (
          <Kb.Box style={errorStyle}>
            <Kb.Text type="BodySmallSemibold">(ノ ゜Д゜)ノ ︵ ┻━┻</Kb.Text>
            {this.props.createConversationError ? (
              <>
                <Kb.Text type="BodySmallSemibold">Failed to create conversation:</Kb.Text>
                <Kb.Text type="BodySmall" style={styles.errorText} selectable={true}>
                  {this.props.createConversationError}
                </Kb.Text>
              </>
            ) : (
              <Kb.Text type="BodySmallSemibold">Failed to create conversation.</Kb.Text>
            )}
          </Kb.Box>
        )}
        {this.props.loadMoreType === 'noMoreToLoad' &&
          !this.props.showRetentionNotice &&
          this.props.pendingState === 'done' && (
            <Kb.Box style={styles.more}>
              {this.props.isHelloBotConversation ? <HelloBotCard /> : <NewChatCard />}
            </Kb.Box>
          )}
        {this.props.showTeamOffer && (
          <Kb.Box style={styles.more}>
            <MakeTeamCard />
          </Kb.Box>
        )}
        {this.props.loadMoreType === 'moreToLoad' && (
          <Kb.Box style={styles.more}>
            <Kb.Text type="BodyBig">
              <Kb.Emoji size={16} emojiName=":moyai:" />
            </Kb.Text>
            <Kb.Text type="BodySmallSemibold">Digging ancient messages...</Kb.Text>
          </Kb.Box>
        )}
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      errorText: {
        marginTop: Styles.globalMargins.tiny,
      },
      loading: {
        marginLeft: Styles.globalMargins.small,
      },
      more: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.medium,
        width: '100%',
      },
      spacer: {
        height: Styles.globalMargins.small,
      },
    } as const)
)

const errorStyle = {
  ...styles.more,
  margin: Styles.globalMargins.medium,
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const hasLoadedEver = state.chat2.messageOrdinals.get(ownProps.conversationIDKey) !== undefined
    const meta = Constants.getMeta(state, ownProps.conversationIDKey)

    let pendingState: Props['pendingState']
    switch (ownProps.conversationIDKey) {
      case Constants.pendingWaitingConversationIDKey:
        pendingState = 'waiting'
        break
      case Constants.pendingErrorConversationIDKey:
        pendingState = 'error'
        break
      default:
        pendingState = 'done'
        break
    }
    const loadMoreType =
      state.chat2.moreToLoadMap.get(ownProps.conversationIDKey) !== false
        ? ('moreToLoad' as const)
        : ('noMoreToLoad' as const)
    const showTeamOffer =
      hasLoadedEver &&
      loadMoreType === 'noMoreToLoad' &&
      meta.teamType === 'adhoc' &&
      meta.participants.length > 2
    const hasOlderResetConversation = meta.supersedes !== Constants.noConversationIDKey
    // don't show default header in the case of the retention notice being visible
    const showRetentionNotice =
      meta.retentionPolicy.type !== 'retain' &&
      !(meta.retentionPolicy.type === 'inherit' && meta.teamRetentionPolicy.type === 'retain')
    const {createConversationError} = state.chat2
    const isHelloBotConversation =
      hasLoadedEver && meta.teamType === 'adhoc' && meta.participants.includes('hellobot')
    return {
      conversationIDKey: ownProps.conversationIDKey,
      createConversationError,
      hasOlderResetConversation,
      isHelloBotConversation,
      loadMoreType,
      measure: ownProps.measure,
      pendingState,
      showRetentionNotice,
      showTeamOffer,
    }
  },
  () => ({}),
  (stateProps, _, __: OwnProps) => ({
    ...stateProps,
  }),
  'TopMessage'
)(TopMessage)
