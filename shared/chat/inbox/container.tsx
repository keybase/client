import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Common from '../../router-v2/common'
import {appendNewChatBuilder} from '../../actions/typed-routes'
import Inbox, {type Props} from '.'
import * as Kb from '../../common-adapters'
import {HeaderNewChatButton} from './new-chat-button'
import {useIsFocused} from '@react-navigation/core'
import isEqual from 'lodash/isEqual'

type OwnProps = {
  navKey: string
  conversationIDKey?: Types.ConversationIDKey
}

const makeBigRows = (
  bigTeams: Array<RPCChatTypes.UIInboxBigTeamRow>,
  selectedConversationIDKey: Types.ConversationIDKey
): Array<Types.ChatInboxRowItemBig | Types.ChatInboxRowItemBigHeader | Types.ChatInboxRowItemTeamBuilder> => {
  return bigTeams.map(t => {
    switch (t.state) {
      case RPCChatTypes.UIInboxBigTeamRowTyp.channel: {
        const conversationIDKey = Types.stringToConversationIDKey(t.channel.convID)
        return {
          channelname: t.channel.channelname,
          conversationIDKey,
          isMuted: t.channel.isMuted,
          selected: conversationIDKey === selectedConversationIDKey,
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
          teamname: t.channel.teamname,
          type: 'big',
        }
      }
      case RPCChatTypes.UIInboxBigTeamRowTyp.label:
        return {
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
          teamID: t.label.id,
          teamname: t.label.name,
          type: 'bigHeader',
        }
      default:
        throw new Error('unknown row typ')
    }
  })
}

const makeSmallRows = (
  smallTeams: Array<RPCChatTypes.UIInboxSmallTeamRow>,
  selectedConversationIDKey: Types.ConversationIDKey
): Array<Types.ChatInboxRowItemSmall | Types.ChatInboxRowItemTeamBuilder> => {
  return smallTeams.map(t => {
    const conversationIDKey = Types.stringToConversationIDKey(t.convID)
    return {
      conversationIDKey,
      isTeam: t.isTeam,
      selected: conversationIDKey === selectedConversationIDKey,
      snippet: t.snippet || undefined,
      snippetDecoration: t.snippetDecoration,
      teamname: t.name,
      time: t.time,
      type: 'small',
    }
  })
}

type WrapperProps = Pick<
  Props,
  'isSearching' | 'navKey' | 'neverLoaded' | 'rows' | 'smallTeamsExpanded' | 'unreadIndices' | 'unreadTotal'
>

const InboxWrapper = React.memo(function InboxWrapper(props: WrapperProps) {
  const dispatch = Container.useDispatch()
  const inboxHasLoaded = Container.useSelector(state => state.chat2.inboxHasLoaded)
  const isFocused = useIsFocused()
  const inboxNumSmallRows = Container.useSelector(state => state.chat2.inboxNumSmallRows ?? 5)
  const allowShowFloatingButton = Container.useSelector(state => {
    const {inboxLayout} = state.chat2
    const inboxNumSmallRows = state.chat2.inboxNumSmallRows ?? 5
    return inboxLayout
      ? (inboxLayout.smallTeams || []).length > inboxNumSmallRows && !!(inboxLayout.bigTeams || []).length
      : false
  })

  // a hack to have it check for marked as read when we mount as the focus events don't fire always
  const onNewChat = React.useCallback(() => {
    dispatch(appendNewChatBuilder())
  }, [dispatch])
  const onUntrustedInboxVisible = React.useCallback(
    (conversationIDKeys: Array<Types.ConversationIDKey>) => {
      dispatch(
        Chat2Gen.createMetaNeedsUpdating({
          conversationIDKeys,
          reason: 'untrusted inbox visible',
        })
      )
    },
    [dispatch]
  )
  const setInboxNumSmallRows = React.useCallback(
    (rows: number) => {
      dispatch(Chat2Gen.createSetInboxNumSmallRows({rows}))
    },
    [dispatch]
  )
  const toggleSmallTeamsExpanded = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleSmallTeamsExpanded())
  }, [dispatch])

  if (Container.isMobile) {
    // eslint-disable-next-line
    React.useEffect(() => {
      if (isFocused && Constants.isSplit) {
        dispatch(Chat2Gen.createTabSelected())
      }
      // eslint-disable-next-line
    }, [isFocused])
  }

  React.useEffect(() => {
    if (!Container.isMobile) {
      // On mobile this is taken care of by NavigationEvents.
      dispatch(Chat2Gen.createTabSelected())
    }
    if (!inboxHasLoaded) {
      dispatch(Chat2Gen.createInboxRefresh({reason: 'componentNeverLoaded'}))
    }
    // we actually only want to run this once, likely we should dispatch a 'inbox saw first'
    // eslint-disable-next-line
  }, [])

  return (
    <Inbox
      {...props}
      allowShowFloatingButton={allowShowFloatingButton}
      onNewChat={onNewChat}
      onUntrustedInboxVisible={onUntrustedInboxVisible}
      setInboxNumSmallRows={setInboxNumSmallRows}
      toggleSmallTeamsExpanded={toggleSmallTeamsExpanded}
      inboxNumSmallRows={inboxNumSmallRows}
    />
  )
})

const buttonWidth = 132
export const getOptions = () => ({
  freezeOnBlur: false, // let it render even if not visible
  headerLeft: () => <Kb.HeaderLeftBlank />,
  headerLeftContainerStyle: {
    ...Common.defaultNavigationOptions.headerLeftContainerStyle,
    minWidth: buttonWidth,
    width: buttonWidth,
  },
  headerRight: () => <HeaderNewChatButton />,
  headerRightContainerStyle: {
    ...Common.defaultNavigationOptions.headerRightContainerStyle,
    minWidth: buttonWidth,
    paddingRight: 8,
    width: buttonWidth,
  },
  headerTitle: () => (
    <Kb.Text type="BodyBig" center={true}>
      Chats
    </Kb.Text>
  ),
})

const Connected = Container.connect(
  (state, ownProps: OwnProps) => {
    const {inboxLayout, inboxHasLoaded} = state.chat2
    const {conversationIDKey} = ownProps
    const neverLoaded = !inboxHasLoaded
    const inboxNumSmallRows = state.chat2.inboxNumSmallRows ?? 5
    return {
      _badgeMap: state.chat2.badgeMap,
      _hasLoadedTrusted: state.chat2.trustedInboxHasLoaded,
      _inboxLayout: inboxLayout,
      _selectedConversationIDKey: conversationIDKey ?? Constants.noConversationIDKey,
      inboxNumSmallRows,
      isSearching: !!state.chat2.inboxSearch,
      neverLoaded,
      smallTeamsExpanded: state.chat2.smallTeamsExpanded,
    }
  },
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => {
    const {navKey} = ownProps
    const bigTeams = stateProps._inboxLayout ? stateProps._inboxLayout.bigTeams || [] : []
    const showAllSmallRows = stateProps.smallTeamsExpanded || !bigTeams.length
    let smallTeams = stateProps._inboxLayout ? stateProps._inboxLayout.smallTeams || [] : []
    const smallTeamsBelowTheFold = !showAllSmallRows && smallTeams.length > stateProps.inboxNumSmallRows
    if (!showAllSmallRows) {
      smallTeams = smallTeams.slice(0, stateProps.inboxNumSmallRows)
    }
    const smallRows = makeSmallRows(smallTeams, stateProps._selectedConversationIDKey)
    const bigRows = makeBigRows(bigTeams, stateProps._selectedConversationIDKey)
    const teamBuilder: Types.ChatInboxRowItemTeamBuilder = {type: 'teamBuilder'}

    const hasAllSmallTeamConvs =
      (stateProps._inboxLayout?.smallTeams?.length ?? 0) === (stateProps._inboxLayout?.totalSmallTeams ?? 0)
    const divider: Array<Types.ChatInboxRowItemDivider | Types.ChatInboxRowItemTeamBuilder> =
      bigRows.length !== 0 || !hasAllSmallTeamConvs
        ? [{showButton: !hasAllSmallTeamConvs || smallTeamsBelowTheFold, type: 'divider'}]
        : []
    if (smallRows.length !== 0) {
      if (bigRows.length === 0) {
        if (divider.length !== 0) {
          divider.push(teamBuilder)
        } else {
          smallRows.push(teamBuilder)
        }
      } else {
        bigRows.push(teamBuilder)
      }
    }
    const nextRows: Array<Types.ChatInboxRowItem> = [...smallRows, ...divider, ...bigRows]
    let rows = nextRows
    // TODO better fix later
    if (isEqual(rows, cachedRows)) {
      rows = cachedRows
    }
    cachedRows = rows

    const unreadIndices: Map<number, number> = new Map()
    let unreadTotal: number = 0
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (row.type === 'big') {
        if (
          row.conversationIDKey &&
          stateProps._badgeMap.get(row.conversationIDKey) &&
          row.conversationIDKey !== stateProps._selectedConversationIDKey
        ) {
          // on mobile include all convos, on desktop only not currently selected convo
          const unreadCount = stateProps._badgeMap.get(row.conversationIDKey) || 0
          unreadIndices.set(i, unreadCount)
          unreadTotal += unreadCount
        }
      }
    }
    return {
      isSearching: stateProps.isSearching,
      navKey,
      neverLoaded: stateProps.neverLoaded,
      rows,
      smallTeamsExpanded: stateProps.smallTeamsExpanded || bigTeams.length === 0,
      unreadIndices: unreadIndices.size ? unreadIndices : emptyMap,
      unreadTotal,
    }
  }
)(InboxWrapper)

let cachedRows: Array<Types.ChatInboxRowItem> = []
const emptyMap = new Map()

export default Connected
