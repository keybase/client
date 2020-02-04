import {namedConnect} from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import ConversationList, {SmallTeamRowItem, BigTeamChannelRowItem, RowItem} from './conversation-list'
import getFilteredRowsAndMetadata from './filtered'

type OwnProps = {
  filter?: string
  focusFilterOnMount?: boolean | null
  onDone?: (() => void) | null
  onSelect: (conversationIDKey: Types.ConversationIDKey) => void
  onSetFilter?: (filter: string) => void
  selected: Types.ConversationIDKey
}

const getRows = (inboxLayout: RPCChatTypes.UIInboxLayout, username: string, ownProps: OwnProps) => {
  let selectedIndex: number | null = null
  const rows = ownProps.filter
    ? getFilteredRowsAndMetadata(inboxLayout, ownProps.filter, username).rows.map((row, index) => {
        const conversationIDKey = row.conversationIDKey
        const common = {
          conversationIDKey,
          isSelected: conversationIDKey === ownProps.selected,
          name: row.teamname,
          onSelectConversation: () => {
            ownProps.onSelect(row.conversationIDKey!)
            ownProps.onDone?.()
          },
        }
        if (common.isSelected) {
          selectedIndex = index
        }
        return row.type === 'big'
          ? ({
              ...common,
              type: 'big',
            } as BigTeamChannelRowItem)
          : ({
              ...common,
              participants: row.teamname!?.split(','),
              type: 'small',
            } as SmallTeamRowItem)
      })
    : inboxLayout.widgetList?.map((wl, index) => {
        const common = {
          conversationIDKey: wl.convID,
          isSelected: wl.convID === ownProps.selected,
          onSelectConversation: () => {
            ownProps.onSelect(wl.convID)
            ownProps.onDone?.()
          },
        }
        if (common.isSelected) {
          selectedIndex = index
        }
        return wl.isTeam
          ? ({
              ...common,
              type: 'big',
            } as BigTeamChannelRowItem)
          : ({
              ...common,
              participants: wl.name.split(','),
              type: 'small',
            } as SmallTeamRowItem)
      }) ?? []
  return {rows, selectedIndex}
}

const selectNext = (rows: Array<RowItem>, current: null | number, delta: 1 | -1) => {
  if (!rows.length) {
    return null
  }
  const nextIndex = (current === null ? (delta > 0 ? 0 : rows.length - 1) : current + delta) % rows.length
  if (rows[nextIndex].type === 'more-less') {
    const row = rows[(nextIndex + 1) % rows.length]
    // two 'more-less' in a row: either that's the only we have or something's
    // wrong elsewhere.
    return row.type === 'more-less' ? null : row.conversationIDKey
  }
  return rows[nextIndex].conversationIDKey
}

// TODO use inbox layout and not meta
export default namedConnect(
  state => ({
    _inboxLayout: state.chat2.inboxLayout,
    _username: state.config.username,
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {selectedIndex, rows} = stateProps._inboxLayout
      ? getRows(stateProps._inboxLayout, stateProps._username, ownProps)
      : {selectedIndex: 0, rows: []}
    return {
      filter: ownProps.onSetFilter && {
        filter: ownProps.filter || '',
        isLoading: false,
        onSetFilter: ownProps.onSetFilter,
      },
      focusFilterOnMount: ownProps.focusFilterOnMount,
      onBack: dispatchProps.onBack,
      onEnsureSelection: () => {
        if (selectedIndex === null) {
          const nextConvIDKey = selectNext(rows, selectedIndex, 1)
          nextConvIDKey && ownProps.onSelect(nextConvIDKey)
        }
        ownProps.onDone && ownProps.onDone()
      },
      onSelectDown: () => {
        const nextConvIDKey = selectNext(rows, selectedIndex, 1)
        nextConvIDKey && ownProps.onSelect(nextConvIDKey)
      },
      onSelectUp: () => {
        const nextConvIDKey = selectNext(rows, selectedIndex, -1)
        nextConvIDKey && ownProps.onSelect(nextConvIDKey)
      },
      rows,
    }
  },
  'ConversationList'
)(ConversationList)
