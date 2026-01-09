import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import type {AllowedColors} from '@/common-adapters/text'
import SelectableSmallTeam from './selectable-small-team'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {
  filter?: string
  name: string
  numSearchHits?: number
  maxSearchHits?: number
  participants?: Array<string>
  isSelected: boolean
  onSelectConversation: () => void
}

const getRowStyles = (isSelected: boolean, hasUnread: boolean) => {
  const backgroundColor = isSelected
    ? Kb.Styles.globalColors.blue
    : Kb.Styles.isPhone
      ? Kb.Styles.globalColors.fastBlank
      : Kb.Styles.globalColors.blueGrey
  const showBold = !isSelected && hasUnread
  const subColor: AllowedColors = isSelected
    ? Kb.Styles.globalColors.white
    : hasUnread
      ? Kb.Styles.globalColors.black
      : Kb.Styles.globalColors.black_50
  const usernameColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black

  return {
    backgroundColor,
    showBold,
    subColor,
    usernameColor,
  }
}

const Container = (ownProps: OwnProps) => {
  const _hasBadge = Chat.useChatContext(s => s.badge > 0)
  const _hasUnread = Chat.useChatContext(s => s.unread > 0)
  const _meta = Chat.useChatContext(s => s.meta)
  const _participantInfo = Chat.useChatContext(s => s.participants)
  const _username = useCurrentUserState(s => s.username)
  const isMuted = Chat.useChatContext(s => s.meta.isMuted)
  const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
  const styles = getRowStyles(isSelected, _hasUnread)
  const participantNeedToRekey = _meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && _meta.rekeyers.has(_username)
  const isLocked = participantNeedToRekey || youNeedToRekey

  // order participants by hit, if it's set
  const filter = ownProps.filter ?? ''
  const metaParts = Chat.getRowParticipants(_participantInfo, _username)
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
