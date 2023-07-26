import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import SelectableSmallTeam from './selectable-small-team'
import type * as Types from '../constants/types/chat2'

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

export default (ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey
  const _hasBadge = Constants.useContext(s => s.badge > 0)
  const _hasUnread = Constants.useContext(s => s.unread > 0)
  const _meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const _participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const _username = ConfigConstants.useCurrentUserState(s => s.username)
  const isMuted = Container.useSelector(state => Constants.isMuted(state, conversationIDKey))
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

  const props = {
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

  return <SelectableSmallTeam {...props} />
}
