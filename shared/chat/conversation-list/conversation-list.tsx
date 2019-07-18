import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
import * as Styles from '../../styles'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {rowHeight} from '../selectable-big-team-channel'
import {rowHeight as shouldEqualToRowHeight} from '../selectable-small-team'

export type SmallTeamRowItem = {
  conversationIDKey: Types.ConversationIDKey
  isSelected: boolean
  onSelectConversation: () => void
  type: 'small'
}

export type BigTeamChannelRowItem = {
  conversationIDKey: Types.ConversationIDKey
  isSelected: boolean
  onSelectConversation: () => void
  type: 'big'
}

type ToggleMoreRowItem = {
  type: 'more-less'
  onClick: () => void
  hiddenCount: number
}

export type RowItem = SmallTeamRowItem | BigTeamChannelRowItem | ToggleMoreRowItem

type Props = {
  rows: Array<RowItem>
  filter?: {
    isLoading: boolean
    filter: string
    onSetFilter: (filter: string) => void
  }
  focusFilterOnMount?: boolean | null
  onBack: () => void
  onEnsureSelection: () => void
  onSelectDown: () => void
  onSelectUp: () => void
}

const _itemRenderer = (_, row) => {
  switch (row.type) {
    case 'small':
      return (
        <SelectableSmallTeam
          conversationIDKey={row.conversationIDKey}
          isSelected={row.isSelected}
          onSelectConversation={row.onSelectConversation}
        />
      )
    case 'big':
      return (
        <SelectableBigTeamChannel
          conversationIDKey={row.conversationIDKey}
          isSelected={row.isSelected}
          onSelectConversation={row.onSelectConversation}
        />
      )
    case 'more-less':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.moreLessContainer}>
          <Kb.Button
            type="Dim"
            label={row.hiddenCount ? `+${row.hiddenCount} more` : 'Show less ...'}
            small={true}
            onClick={row.onClick}
          />
        </Kb.Box2>
      )
    default:
      return null
  }
}

const ConversationList = (props: Props) => {
  if (rowHeight !== shouldEqualToRowHeight) {
    // Sanity check, in case this changes in the future
    return <Kb.Text type="BodyBigExtrabold">item size changes, should use use variable size list</Kb.Text>
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.List2
        itemHeight={{height: rowHeight, type: 'fixed'}}
        items={props.rows}
        renderItem={_itemRenderer}
        indexAsKey={true}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  filter: {
    backgroundColor: Styles.globalColors.fastBlank,
  },
  moreLessContainer: {
    height: rowHeight,
  },
})

export default ConversationList
