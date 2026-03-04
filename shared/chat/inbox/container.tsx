import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as T from '@/constants/types'
import Inbox from '.'
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

const noSmallTeams = new Array<T.RPCChat.UIInboxSmallTeamRow>()
const noBigTeams = new Array<T.RPCChat.UIInboxBigTeamRow>()
const emptyMap = new Map()

const Connected = (ownProps: OwnProps) => {
  const {navKey, conversationIDKey} = ownProps
  const isFocused = useIsFocused()

  const chatState = Chat.useChatState(
    C.useShallow(s => {
      const inboxNumSmallRows = s.inboxNumSmallRows ?? 5
      const smallTeams = s.inboxLayout?.smallTeams ?? noSmallTeams
      const bigTeams = s.inboxLayout?.bigTeams ?? noBigTeams
      const allowShowFloatingButton = smallTeams.length > inboxNumSmallRows && bigTeams.length > 0
      return {
        allowShowFloatingButton,
        bigTeams,
        inboxHasLoaded: s.inboxHasLoaded,
        inboxNumSmallRows,
        inboxRefresh: s.dispatch.inboxRefresh,
        isSearching: !!s.inboxSearch,
        queueMetaToRequest: s.dispatch.queueMetaToRequest,
        setInboxNumSmallRows: s.dispatch.setInboxNumSmallRows,
        smallTeams,
        smallTeamsExpanded: s.smallTeamsExpanded,
        toggleSmallTeamsExpanded: s.dispatch.toggleSmallTeamsExpanded,
        totalSmallTeams: s.inboxLayout?.totalSmallTeams ?? 0,
      }
    })
  )
  const {
    allowShowFloatingButton, inboxHasLoaded, inboxNumSmallRows, bigTeams,
    inboxRefresh, isSearching, queueMetaToRequest, setInboxNumSmallRows,
    smallTeams: allSmallTeams, smallTeamsExpanded, toggleSmallTeamsExpanded, totalSmallTeams,
  } = chatState

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const selectedConversationIDKey = conversationIDKey ?? Chat.noConversationIDKey

  // Handle focus changes on mobile
  const prevIsFocusedRef = React.useRef(isFocused)
  React.useEffect(() => {
    if (prevIsFocusedRef.current === isFocused) return
    prevIsFocusedRef.current = isFocused
    if (C.isMobile && isFocused && Chat.isSplit) {
      Chat.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
  }, [isFocused])

  C.useOnMountOnce(() => {
    if (!C.isMobile) {
      Chat.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  C.Router2.useSafeFocusEffect(() => {
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  // Compute rows
  const showAllSmallRows = smallTeamsExpanded || !bigTeams.length
  const smallTeamsBelowTheFold = !showAllSmallRows && allSmallTeams.length > inboxNumSmallRows
  const smallTeams = showAllSmallRows ? allSmallTeams : allSmallTeams.slice(0, inboxNumSmallRows)
  const smallRows = makeSmallRows(smallTeams)
  const bigRows = makeBigRows(bigTeams)

  const smallConvIds = React.useMemo(
    () => new Set(smallRows.map(r => r.type === 'small' ? r.conversationIDKey : '' as T.Chat.ConversationIDKey).filter(Boolean)),
    [smallRows]
  )

  const hasAllSmallTeamConvs = allSmallTeams.length === totalSmallTeams
  const divider: Array<ChatInboxRowItemDivider | ChatInboxRowItemTeamBuilder> =
    bigRows.length !== 0 || !hasAllSmallTeamConvs
      ? [{showButton: !hasAllSmallTeamConvs || smallTeamsBelowTheFold, smallConvIds, type: 'divider'}]
      : []

  const teamBuilder: ChatInboxRowItemTeamBuilder = {type: 'teamBuilder'}
  const builderAfterSmall: Array<ChatInboxRowItemTeamBuilder> = []
  const builderAfterDivider: Array<ChatInboxRowItemTeamBuilder> = []
  const builderAfterBig: Array<ChatInboxRowItemTeamBuilder> = []
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
  const rows: Array<ChatInboxRowItem> = [
    ...smallRows,
    ...builderAfterSmall,
    ...divider,
    ...builderAfterDivider,
    ...bigRows,
    ...builderAfterBig,
  ]

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

  return (
    <Inbox
      allowShowFloatingButton={allowShowFloatingButton}
      inboxNumSmallRows={inboxNumSmallRows}
      isSearching={isSearching}
      navKey={navKey}
      neverLoaded={!inboxHasLoaded}
      onNewChat={appendNewChatBuilder}
      onUntrustedInboxVisible={queueMetaToRequest}
      rows={rows}
      selectedConversationIDKey={selectedConversationIDKey}
      setInboxNumSmallRows={setInboxNumSmallRows}
      smallTeamsExpanded={smallTeamsExpanded || !bigTeams.length}
      toggleSmallTeamsExpanded={toggleSmallTeamsExpanded}
      unreadIndices={unreadIndices.size ? unreadIndices : emptyMap}
      unreadTotal={unreadTotal}
    />
  )
}

export default Connected
