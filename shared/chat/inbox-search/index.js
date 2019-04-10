// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
import * as Styles from '../../styles'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {inboxWidth} from '../inbox/row/sizes'

type NameResult = {|
  conversationIDKey: Types.ConversationIDKey,
  type: 'big' | 'small',
|}

type TextResult = {|
  conversationIDKey: Types.ConversationIDKey,
  type: 'big' | 'small',
  numHits: number,
|}

type Props = {|
  nameStatus: Types.InboxSearchStatus,
  nameResults: Array<NameResult>,
  onSelectConversation: Types.ConversationIDKey => void,
  selectedIndex: number,
  textStatus: Types.InboxSearchStatus,
  textResults: Array<TextResult>,
|}

const renderNameResult = (r, onSelectConversation) => {
  return r.type === 'big' ? (
    <SelectableBigTeamChannel
      conversationIDKey={r.conversationIDKey}
      isSelected={false}
      onSelectConversation={onSelectConversation}
    />
  ) : (
    <SelectableSmallTeam
      conversationIDKey={r.conversationIDKey}
      isSelected={false}
      onSelectConversation={onSelectConversation}
    />
  )
}

const InboxSearch = (props: Props) => {
  const nameResults = props.nameResults.map(r =>
    renderNameResult(r, () => props.onSelectConversation(r.conversationIDKey))
  )
  return (
    <Kb.Box2 style={styles.container} direction="vertical">
      {nameResults}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.blueGrey,
      contain: 'strict',
      height: '100%',
      maxWidth: inboxWidth,
      minWidth: inboxWidth,
      position: 'relative',
    },
  }),
})

export default InboxSearch
