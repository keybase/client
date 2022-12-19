import * as Constants from '../constants/chat2'
import type * as Types from '../constants/types/chat2'
import SelectableSmallTeam from './selectable-small-team'
import * as Container from '../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  filter?: string
  name: string
  numSearchHits?: number
  maxSearchHits?: number
  participants?: Array<string>
  isSelected: boolean
  onSelectConversation: () => void
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.conversationIDKey
    return {
      _hasBadge: Constants.getHasBadge(state, conversationIDKey),
      _hasUnread: Constants.getHasUnread(state, conversationIDKey),
      _meta: Constants.getMeta(state, conversationIDKey),
      _participantInfo: Constants.getParticipantInfo(state, conversationIDKey),
      _username: state.config.username,
      isMuted: Constants.isMuted(state, conversationIDKey),
    }
  },
  () => ({}),
  (stateProps, _, ownProps) => {
    const {isMuted, _hasBadge, _meta, _participantInfo, _hasUnread, _username} = stateProps
    const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
    const styles = Constants.getRowStyles(isSelected, _hasUnread)
    const participantNeedToRekey = _meta.rekeyers.size > 0
    const youNeedToRekey = !participantNeedToRekey && _meta.rekeyers.has(_username)
    const isLocked = participantNeedToRekey || youNeedToRekey

    // order participants by hit, if it's set
    const filter = ownProps.filter ?? ''
    const metaParts = Constants.getRowParticipants(_participantInfo, _username)
    let participants = ownProps.participants ?? (metaParts.length > 0 ? metaParts : name.split(','))
    participants = participants.sort((a, b) => {
      const ai = a.indexOf(filter)
      const bi = b.indexOf(filter)

      if (ai === -1) {
        return bi === -1 ? -1 : 1
      } else if (bi === -1) {
        return -1
      } else {
        return bi === 0 ? 1 : -1
      }
    })

    return {
      backgroundColor: styles.backgroundColor,
      isLocked,
      isMuted,
      isSelected,
      maxSearchHits,
      numSearchHits,
      onSelectConversation,
      participants,
      showBadge: _hasBadge,
      showBold: styles.showBold,
      snippet: _meta.snippet,
      snippetDecoration: _meta.snippetDecoration,
      teamname: _meta.teamname,
      usernameColor: styles.usernameColor,
    }
  }
)(SelectableSmallTeam)
