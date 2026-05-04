import * as Kb from '@/common-adapters'
import type {AllowedColors} from '@/common-adapters/text.shared'
import SelectableSmallTeam from './selectable-small-team'
import {useInboxRowSmall} from '@/stores/inbox-rows'
import type * as T from '@/constants/types'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey
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
      ? undefined
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
  const {conversationIDKey} = ownProps
  const row = useInboxRowSmall(conversationIDKey)
  const _hasBadge = row.hasBadge
  const _hasUnread = row.hasUnread
  const isMuted = row.isMuted
  const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
  const styles = getRowStyles(isSelected, _hasUnread)
  const isLocked = row.isLocked || row.participantNeedToRekey || row.youNeedToRekey

  // order participants by hit, if it's set
  const filter = ownProps.filter ?? ''
  let participants = ownProps.participants ?? (row.participants.length > 0 ? [...row.participants] : name.split(','))
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
    conversationIDKey,
    isLocked,
    isMuted,
    isSelected,
    maxSearchHits,
    numSearchHits,
    onSelectConversation,
    participants,
    showBadge: _hasBadge,
    showBold: styles.showBold,
    snippet: row.snippet,
    snippetDecoration: row.snippetDecoration,
    teamname: row.teamDisplayName,
    usernameColor: styles.usernameColor,
  }

  return <SelectableSmallTeam {...props} />
}

export default Container
