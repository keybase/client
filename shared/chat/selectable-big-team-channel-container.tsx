import * as ConvoState from '@/stores/convostate'
import SelectableBigTeamChannel from './selectable-big-team-channel'

type OwnProps = {
  isSelected: boolean
  maxSearchHits?: number | undefined
  name: string
  numSearchHits?: number | undefined
  onSelectConversation: () => void
}

const Container = (ownProps: OwnProps) => {
  const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
  const showBold = ConvoState.useChatContext(s => s.unread > 0)
  const showBadge = ConvoState.useChatContext(s => s.badge > 0)
  const _meta = ConvoState.useChatContext(s => s.meta)
  let teamname = _meta.teamname
  let channelname = _meta.channelname
  if (!teamname) {
    const parts = name.split('#')
    if (parts.length >= 2) {
      teamname = parts[0]!
      channelname = parts[1]!
    }
  }
  const props = {
    channelname,
    isSelected,
    maxSearchHits,
    numSearchHits,
    onSelectConversation,
    showBadge,
    showBold: showBold && !isSelected,
    snippet: _meta.snippet,
    snippetDecoration: _meta.snippetDecoration,
    teamname,
  }
  return <SelectableBigTeamChannel {...props} />
}

export default Container
