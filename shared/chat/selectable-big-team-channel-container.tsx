import * as Constants from '../constants/chat2'
import SelectableBigTeamChannel from './selectable-big-team-channel'

type OwnProps = {
  isSelected: boolean
  maxSearchHits?: number
  name: string
  numSearchHits?: number
  onSelectConversation: () => void
}

export default (ownProps: OwnProps) => {
  const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
  const showBold = Constants.useContext(s => s.unread > 0)
  const showBadge = Constants.useContext(s => s.badge > 0)
  const _meta = Constants.useContext(s => s.meta)
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
