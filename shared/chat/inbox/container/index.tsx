import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import {appendNewChatBuilder} from '../../../actions/typed-routes'
import Inbox from '..'
import {isMobile} from '../../../constants/platform'
import {
  Props as _Props,
  RowItemSmall,
  RowItemBig,
  RowItemBigHeader,
  RowItemDivider,
  RowItemTeamBuilder,
  RowItem,
} from '..'
import * as Kb from '../../../common-adapters'
import {HeaderNewChatButton} from './new-chat-button'

type OwnProps = Container.PropsWithSafeNavigation

const makeBigRows = (
  bigTeams: Array<RPCChatTypes.UIInboxBigTeamRow>
): Array<RowItemBig | RowItemBigHeader> => {
  return bigTeams.map(t => {
    switch (t.state) {
      case RPCChatTypes.UIInboxBigTeamRowTyp.channel:
        return {
          channelname: t.channel.channelname,
          conversationIDKey: Types.stringToConversationIDKey(t.channel.convID),
          isMuted: t.channel.isMuted,
          teamname: t.channel.teamname,
          type: 'big',
        }
      case RPCChatTypes.UIInboxBigTeamRowTyp.label:
        return {teamname: t.label, type: 'bigHeader'}
      default:
        throw new Error('unknown row typ')
    }
  })
}

const makeSmallRows = (smallTeams: Array<RPCChatTypes.UIInboxSmallTeamRow>): Array<RowItemSmall> => {
  return smallTeams.map(t => {
    return {
      conversationIDKey: Types.stringToConversationIDKey(t.convID),
      isTeam: t.isTeam,
      snippet: t.snippet || undefined,
      snippetDecoration: t.snippetDecoration || undefined,
      teamname: t.name,
      time: t.time,
      type: 'small',
    }
  })
}

type Props = {
  _hasLoadedTrusted: boolean
  _onInitialLoad: (array: Array<Types.ConversationIDKey>) => void
  _refreshInbox: () => void
  _canRefreshOnMount: boolean
  _onMountedDesktop: () => void
} & _Props

class InboxWrapper extends React.PureComponent<Props> {
  static navigationOptions = {
    header: undefined,
    headerRight: <HeaderNewChatButton />,
    headerTitle: () => (
      <Kb.Text type="BodyBig" lineClamp={1}>
        {' '}
        Chats{' '}
      </Kb.Text>
    ),
    title: 'Chats',
  }

  componentDidMount() {
    if (!isMobile) {
      this.props._onMountedDesktop()
    }
    if (this.props._canRefreshOnMount) {
      this.props._refreshInbox()
    }
    if (!this.props._hasLoadedTrusted && this.props.rows.length) {
      const toUnbox = this.props.rows.slice(0, 20).reduce<Array<Types.ConversationIDKey>>((arr, row) => {
        if (row.type === 'small') {
          arr.push(row.conversationIDKey)
        }
        return arr
      }, [])
      if (toUnbox.length) {
        this.props._onInitialLoad(toUnbox)
      }
    }
  }

  render() {
    const {
      _hasLoadedTrusted,
      _refreshInbox,
      _onInitialLoad,
      _canRefreshOnMount,
      _onMountedDesktop,
      ...rest
    } = this.props
    return <Inbox {...rest} />
  }
}

const Connected = Container.namedConnect(
  state => {
    const {inboxLayout, inboxHasLoaded} = state.chat2
    let {inboxNumSmallRows} = state.chat2
    if (inboxNumSmallRows === undefined) {
      inboxNumSmallRows = 5
    }
    const neverLoaded = !inboxHasLoaded
    const allowShowFloatingButton = inboxLayout
      ? (inboxLayout.smallTeams || []).length > inboxNumSmallRows && !!(inboxLayout.bigTeams || []).length
      : false
    return {
      _badgeMap: state.chat2.badgeMap,
      _canRefreshOnMount: neverLoaded,
      _hasLoadedTrusted: state.chat2.trustedInboxHasLoaded,
      _inboxLayout: inboxLayout,
      _selectedConversationIDKey: state.chat2.selectedConversation,
      allowShowFloatingButton,
      inboxNumSmallRows,
      isLoading: isMobile ? Constants.anyChatWaitingKeys(state) : false, // desktop doesn't use isLoading so ignore it
      isSearching: !!state.chat2.inboxSearch,
      neverLoaded,
      smallTeamsExpanded: state.chat2.smallTeamsExpanded,
    }
  },
  dispatch => ({
    // a hack to have it check for marked as read when we mount as the focus events don't fire always
    _onInitialLoad: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
      dispatch(Chat2Gen.createMetaNeedsUpdating({conversationIDKeys, reason: 'initialTrustedLoad'})),
    _onMountedDesktop: () => {
      dispatch(Chat2Gen.createTabSelected())
    },
    _refreshInbox: () => dispatch(Chat2Gen.createInboxRefresh({reason: 'componentNeverLoaded'})),
    onNewChat: () => dispatch(appendNewChatBuilder()),
    onUntrustedInboxVisible: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
      dispatch(
        Chat2Gen.createMetaNeedsUpdating({
          conversationIDKeys,
          reason: 'untrusted inbox visible',
        })
      ),
    setInboxNumSmallRows: (rows: number) => dispatch(Chat2Gen.createSetInboxNumSmallRows({rows})),
    toggleSmallTeamsExpanded: () => dispatch(Chat2Gen.createToggleSmallTeamsExpanded()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const bigTeams = stateProps._inboxLayout ? stateProps._inboxLayout.bigTeams || [] : []
    const hasBigTeams = bigTeams.length
    const showAllSmallRows = stateProps.smallTeamsExpanded || !bigTeams.length
    let smallTeams = stateProps._inboxLayout ? stateProps._inboxLayout.smallTeams || [] : []
    const smallTeamsBelowTheFold = !showAllSmallRows && smallTeams.length > stateProps.inboxNumSmallRows
    if (!showAllSmallRows) {
      smallTeams = smallTeams.slice(0, stateProps.inboxNumSmallRows)
    }
    const smallRows = makeSmallRows(smallTeams)
    const bigRows = makeBigRows(bigTeams)
    const divider: Array<RowItemDivider> =
      bigRows.length !== 0 ? [{showButton: smallTeamsBelowTheFold, type: 'divider'}] : []
    const teamBuilder: Array<RowItemTeamBuilder> = bigRows.length !== 0 ? [{type: 'teamBuilder'}] : []
    const rows: Array<RowItem> = [...smallRows, ...divider, ...bigRows, ...teamBuilder]

    const unreadIndices: Array<number> = []
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (!['big', 'bigHeader', 'teamBuilder'].includes(row.type)) {
        // only check big teams for large inbox perf
        break
      }
      if (
        row.conversationIDKey &&
        stateProps._badgeMap.get(row.conversationIDKey) &&
        row.conversationIDKey !== stateProps._selectedConversationIDKey
      ) {
        // on mobile include all convos, on desktop only not currently selected convo
        unreadIndices.unshift(i)
      }
    }

    return {
      _canRefreshOnMount: stateProps._canRefreshOnMount,
      _hasLoadedTrusted: stateProps._hasLoadedTrusted,
      _onInitialLoad: dispatchProps._onInitialLoad,
      _onMountedDesktop: dispatchProps._onMountedDesktop,
      _refreshInbox: dispatchProps._refreshInbox,
      allowShowFloatingButton: stateProps.allowShowFloatingButton,
      hasBigTeams,
      inboxNumSmallRows: stateProps.inboxNumSmallRows,
      isLoading: stateProps.isLoading,
      isSearching: stateProps.isSearching,
      navKey: ownProps.navKey,
      neverLoaded: stateProps.neverLoaded,
      onNewChat: dispatchProps.onNewChat,
      onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
      rows,
      setInboxNumSmallRows: dispatchProps.setInboxNumSmallRows,
      smallTeamsExpanded: stateProps.smallTeamsExpanded,
      title: 'Chats',
      toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
      unreadIndices,
    }
  },
  'Inbox'
)(InboxWrapper)

export default Container.withSafeNavigation(Connected)
