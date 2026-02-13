import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as T from '@/constants/types'
import Inbox, {type Props} from '.'
import {useIsFocused} from '@react-navigation/core'
import type {
  ChatInboxRowItemBig,
  ChatInboxRowItemBigHeader,
  ChatInboxRowItemTeamBuilder,
  ChatInboxRowItemSmall,
  ChatInboxRowItemDivider,
  ChatInboxRowItem,
} from './rowitem'

type OwnProps = {
  navKey: string
  conversationIDKey?: T.Chat.ConversationIDKey
}

const makeBigRows = (
  bigTeams: ReadonlyArray<T.RPCChat.UIInboxBigTeamRow>
): Array<ChatInboxRowItemBig | ChatInboxRowItemBigHeader | ChatInboxRowItemTeamBuilder> => {
  return bigTeams.map(t => {
    switch (t.state) {
      case T.RPCChat.UIInboxBigTeamRowTyp.channel: {
        const conversationIDKey = T.Chat.stringToConversationIDKey(t.channel.convID)
        return {
          channelname: t.channel.channelname,
          conversationIDKey,
          isMuted: t.channel.isMuted,
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          teamname: t.channel.teamname,
          type: 'big',
        }
      }
      case T.RPCChat.UIInboxBigTeamRowTyp.label:
        return {
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
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
  smallTeams: ReadonlyArray<T.RPCChat.UIInboxSmallTeamRow>
): Array<ChatInboxRowItemSmall | ChatInboxRowItemTeamBuilder> => {
  return smallTeams.map(t => {
    const conversationIDKey = T.Chat.stringToConversationIDKey(t.convID)
    return {
      conversationIDKey,
      isTeam: t.isTeam,
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
  | 'isSearching'
  | 'navKey'
  | 'neverLoaded'
  | 'rows'
  | 'smallTeamsExpanded'
  | 'unreadIndices'
  | 'unreadTotal'
  | 'selectedConversationIDKey'
>

const InboxWrapper = React.memo(function InboxWrapper(props: WrapperProps) {
  const chatState = Chat.useChatState(
    C.useShallow(s => {
      const inboxNumSmallRows = s.inboxNumSmallRows ?? 5
      const {inboxLayout} = s
      const allowShowFloatingButton = inboxLayout
        ? (inboxLayout.smallTeams || []).length > inboxNumSmallRows && !!(inboxLayout.bigTeams || []).length
        : false
      return {
        allowShowFloatingButton,
        inboxHasLoaded: s.inboxHasLoaded,
        inboxNumSmallRows,
        inboxRefresh: s.dispatch.inboxRefresh,
        queueMetaToRequest: s.dispatch.queueMetaToRequest,
        setInboxNumSmallRows: s.dispatch.setInboxNumSmallRows,
        toggleSmallTeamsExpanded: s.dispatch.toggleSmallTeamsExpanded,
      }
    })
  )
  const {allowShowFloatingButton, inboxHasLoaded, inboxNumSmallRows, inboxRefresh} = chatState
  const {queueMetaToRequest, setInboxNumSmallRows, toggleSmallTeamsExpanded} = chatState
  const isFocused = useIsFocused()

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  // a hack to have it check for marked as read when we mount as the focus events don't fire always
  const onNewChat = appendNewChatBuilder
  const onUntrustedInboxVisible = queueMetaToRequest
  const [lastIsFocused, setLastIsFocused] = React.useState(isFocused)

  if (lastIsFocused !== isFocused) {
    setLastIsFocused(isFocused)
    if (C.isMobile) {
      if (isFocused && Chat.isSplit) {
        setTimeout(() => {
          Chat.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
        }, 0)
      }
    }
  }

  C.useOnMountOnce(() => {
    if (!C.isMobile) {
      // On mobile this is taken care of by NavigationEvents.
      Chat.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (!inboxHasLoaded) {
        inboxRefresh('componentNeverLoaded')
      }
    }, [inboxHasLoaded, inboxRefresh])
  )

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

const noSmallTeams = new Array<T.RPCChat.UIInboxSmallTeamRow>()
const noBigTeams = new Array<T.RPCChat.UIInboxBigTeamRow>()
const Connected = (ownProps: OwnProps) => {
  const chatState = Chat.useChatState(
    C.useShallow(s => ({
      inboxHasLoaded: s.inboxHasLoaded,
      inboxLayout: s.inboxLayout,
      inboxNumSmallRows: s.inboxNumSmallRows ?? 5,
      isSearching: !!s.inboxSearch,
      smallTeamsExpanded: s.smallTeamsExpanded,
    }))
  )
  const {inboxHasLoaded, inboxLayout: _inboxLayout, inboxNumSmallRows} = chatState
  const {isSearching, smallTeamsExpanded} = chatState
  const {conversationIDKey} = ownProps
  const neverLoaded = !inboxHasLoaded
  const selectedConversationIDKey = conversationIDKey ?? Chat.noConversationIDKey
  const {navKey} = ownProps
  const bigTeams = _inboxLayout ? _inboxLayout.bigTeams || noBigTeams : noBigTeams
  const showAllSmallRows = smallTeamsExpanded || !bigTeams.length
  const allSmallTeams = _inboxLayout ? _inboxLayout.smallTeams || noSmallTeams : noSmallTeams
  const smallTeamsBelowTheFold = !showAllSmallRows && allSmallTeams.length > inboxNumSmallRows
  const smallTeams = React.useMemo(() => {
    if (!showAllSmallRows) {
      return allSmallTeams.slice(0, inboxNumSmallRows)
    } else {
      return allSmallTeams
    }
  }, [showAllSmallRows, inboxNumSmallRows, allSmallTeams])
  const smallRows = React.useMemo(() => {
    return makeSmallRows(smallTeams)
  }, [smallTeams])

  const bigRows = React.useMemo(() => {
    return makeBigRows(bigTeams)
  }, [bigTeams])

  const hasAllSmallTeamConvs =
    (_inboxLayout?.smallTeams?.length ?? 0) === (_inboxLayout?.totalSmallTeams ?? 0)
  const divider: Array<ChatInboxRowItemDivider | ChatInboxRowItemTeamBuilder> = React.useMemo(() => {
    return bigRows.length !== 0 || !hasAllSmallTeamConvs
      ? [{showButton: !hasAllSmallTeamConvs || smallTeamsBelowTheFold, type: 'divider'}]
      : []
  }, [bigRows.length, hasAllSmallTeamConvs, smallTeamsBelowTheFold])

  const rows: Array<ChatInboxRowItem> = React.useMemo(() => {
    const builderAfterSmall = new Array<ChatInboxRowItemTeamBuilder>()
    const builderAfterDivider = new Array<ChatInboxRowItemTeamBuilder>()
    const builderAfterBig = new Array<ChatInboxRowItemTeamBuilder>()
    const teamBuilder: ChatInboxRowItemTeamBuilder = {type: 'teamBuilder'}
    if (smallRows.length !== 0) {
      if (bigRows.length === 0) {
        if (divider.length !== 0) {
          builderAfterDivider.push(teamBuilder)
        } else {
          builderAfterSmall.push(teamBuilder)
        }
      } else {
        builderAfterBig.push(teamBuilder)
      }
    }
    return [
      ...smallRows,
      ...builderAfterSmall,
      ...divider,
      ...builderAfterDivider,
      ...bigRows,
      ...builderAfterBig,
    ]
  }, [bigRows, smallRows, divider])

  const unreadIndices = Chat.useChatState(
    C.useShallow(s =>
      s.getUnreadIndicies(
        rows.map(row => {
          if (row.type === 'big' && row.conversationIDKey !== selectedConversationIDKey) {
            return row.conversationIDKey
          }
          return ''
        })
      )
    )
  )

  const unreadTotal = Array.from(unreadIndices.values()).reduce((acc, val) => acc + val, 0)

  const props = {
    isSearching,
    navKey,
    neverLoaded,
    rows,
    selectedConversationIDKey,
    smallTeamsExpanded: smallTeamsExpanded || bigTeams.length === 0,
    unreadIndices: unreadIndices.size ? unreadIndices : emptyMap,
    unreadTotal,
  }
  return <InboxWrapper {...props} />
}

const emptyMap = new Map()

export default Connected
