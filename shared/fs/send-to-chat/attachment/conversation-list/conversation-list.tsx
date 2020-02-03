import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import SelectableSmallTeam from '../../../../chat/selectable-small-team-container'
import SelectableBigTeamChannel from '../../../../chat/selectable-big-team-channel-container'
import {rowHeight} from '../../../../chat/selectable-big-team-channel'
import {rowHeight as shouldEqualToRowHeight} from '../../../../chat/selectable-small-team'

/* This is used in Fs tab for sending attachments to chat. Please check to make
 * sure it doesn't break there if you make changes to this file. */

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
  conversationIDKey: undefined
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

const _itemRenderer = (_: number, row: RowItem) => {
  switch (row.type) {
    case 'small':
      return (
        <SelectableSmallTeam
          conversationIDKey={row.conversationIDKey}
          isSelected={row.isSelected}
          name=""
          onSelectConversation={row.onSelectConversation}
        />
      )
    case 'big':
      return (
        <SelectableBigTeamChannel
          conversationIDKey={row.conversationIDKey}
          isSelected={row.isSelected}
          name=""
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
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(Chat2Gen.createInboxRefresh({reason: 'shareConfigSearch'}))
  }, [dispatch])
  if (rowHeight !== shouldEqualToRowHeight) {
    // Sanity check, in case this changes in the future
    return <Kb.Text type="BodyBigExtrabold">item size changes, should use use variable size list</Kb.Text>
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {!!props.filter && (
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.filterContainer}>
          <Kb.SearchFilter
            placeholderText="Search"
            onChange={props.filter.onSetFilter}
            size="small"
            icon="iconfont-search"
          />
        </Kb.Box2>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      filterContainer: Styles.platformStyles({
        isElectron: {
          padding: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
        },
      }),
      moreLessContainer: {
        height: rowHeight,
      },
    } as const)
)

export default ConversationList
