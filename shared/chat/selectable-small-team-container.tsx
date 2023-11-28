import * as C from '@/constants'
import SelectableSmallTeam from './selectable-small-team'

type OwnProps = {
  filter?: string
  name: string
  numSearchHits?: number
  maxSearchHits?: number
  participants?: Array<string>
  isSelected: boolean
  onSelectConversation: () => void
}

const Container = (ownProps: OwnProps) => {
  const _hasBadge = C.useChatContext(s => s.badge > 0)
  const _hasUnread = C.useChatContext(s => s.unread > 0)
  const _meta = C.useChatContext(s => s.meta)
  const _participantInfo = C.useChatContext(s => s.participants)
  const _username = C.useCurrentUserState(s => s.username)
  const isMuted = C.useChatContext(s => s.meta.isMuted)
  const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
  const styles = C.Chat.getRowStyles(isSelected, _hasUnread)
  const participantNeedToRekey = _meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && _meta.rekeyers.has(_username)
  const isLocked = participantNeedToRekey || youNeedToRekey

  // order participants by hit, if it's set
  const filter = ownProps.filter ?? ''
  const metaParts = C.Chat.getRowParticipants(_participantInfo, _username)
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

export default Container
