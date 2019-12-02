import * as Constants from '../constants/chat2'
import * as Types from '../constants/types/chat2'
import SelectableSmallTeam from './selectable-small-team'
import {namedConnect} from '../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  filter?: string
  name: string
  numSearchHits?: number
  maxSearchHits?: number
  isSelected: boolean
  onSelectConversation: () => void
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey

  return {
    _hasBadge: Constants.getHasBadge(state, conversationIDKey),
    _hasUnread: Constants.getHasUnread(state, conversationIDKey),
    _meta: Constants.getMeta(state, conversationIDKey),
    _username: state.config.username,
    isMuted: Constants.isMuted(state, conversationIDKey),
  }
}

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, _, ownProps) => {
  const hasUnread = stateProps._hasUnread
  const styles = Constants.getRowStyles(ownProps.isSelected, hasUnread)
  const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)
  const isLocked = participantNeedToRekey || youNeedToRekey

  // order participants by hit, if it's set
  const filter = ownProps.filter || ''
  const metaParts = Constants.getRowParticipants(stateProps._meta, stateProps._username)
  let participants = metaParts.length > 0 ? metaParts : ownProps.name.split(',')
  participants = participants.sort((a, b) => {
    const ai = a.indexOf(filter)
    const bi = b.indexOf(filter)

    if (ai === -1) {
      return bi === -1 ? -1 : 1
    } else if (bi === -1) {
      return -1
    } else {
      if (bi === 0) {
        return 1
      }
      return -1
    }
  })

  return {
    backgroundColor: styles.backgroundColor,
    isLocked,
    isMuted: stateProps.isMuted,
    isSelected: ownProps.isSelected,
    maxSearchHits: ownProps.maxSearchHits,
    numSearchHits: ownProps.numSearchHits,
    onSelectConversation: ownProps.onSelectConversation,
    participants,
    showBadge: stateProps._hasBadge,
    showBold: styles.showBold,
    snippet: stateProps._meta.snippet,
    snippetDecoration: stateProps._meta.snippetDecoration,
    teamname: stateProps._meta.teamname,
    usernameColor: styles.usernameColor,
  }
}

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SelectableSmallTeam'
)(SelectableSmallTeam)
