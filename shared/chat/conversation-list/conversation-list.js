// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {rowHeight} from '../selectable-big-team-channel'
import {rowHeight as shouldEqualToRowHeight} from '../selectable-small-team'
import ConversationFilterInput from '../conversation-filter-input'

export type SmallTeamRowItem = {|
  conversationIDKey: Types.ConversationIDKey,
  isSelected: boolean,
  onSelectConversation: () => void,
  type: 'small',
|}

export type BigTeamChannelRowItem = {|
  conversationIDKey: Types.ConversationIDKey,
  isSelected: boolean,
  onSelectConversation: () => void,
  type: 'big',
|}

type ToggleMoreRowItem = {|
  type: 'more-less',
  onClick: () => void,
  hiddenCount: number,
|}

type RowItem = SmallTeamRowItem | BigTeamChannelRowItem | ToggleMoreRowItem

type Props = {|
  rows: Array<RowItem>,
  filter?: {
    isLoading: boolean,
    filter: string,
    onSetFilter: (filter: string) => void,
  },
|}

const _itemRenderer = (index, row) => {
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
            type="Secondary"
            label={row.hiddenCount ? `+${row.hiddenCount} more` : 'Show less ...'}
            small={true}
            onClick={row.onClick}
          />
        </Kb.Box2>
      )
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(row.type)
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
      {!!props.filter && (
        <ConversationFilterInput
          style={styles.filter}
          isLoading={props.filter.isLoading}
          filter={props.filter.filter}
          onSetFilter={props.filter.onSetFilter}
          filterFocusCount={0}
          onBlur={() => {}}
          onFocus={() => {}}
          onSelectDown={() => {} /* TODO: make these work */}
          onSelectUp={() => {}}
          onEnsureSelection={() => {}}
        />
      )}
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
