import * as C from '../../../constants'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader} from './index.native'
import {DebugChatDumpContext} from '../../../constants/chat2/debug'
import {HeaderLeftArrow} from '../../../common-adapters/header-hoc'
import {Keyboard} from 'react-native'
import {getRouteParamsFromRoute} from '../../../router-v2/route-params'

export const HeaderAreaRight = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const pendingWaiting =
    conversationIDKey === C.pendingWaitingConversationIDKey ||
    conversationIDKey === C.pendingErrorConversationIDKey
  const {chatDebugDump} = React.useContext(DebugChatDumpContext)
  const [showToast, setShowToast] = React.useState(false)

  const dumpIcon = chatDebugDump ? (
    <>
      <Kb.SimpleToast iconType="iconfont-check" text="Logged, send feedback" visible={showToast} />
      <Kb.Icon
        type="iconfont-keybase"
        onClick={() => {
          chatDebugDump()
          setShowToast(true)
          setTimeout(() => {
            setShowToast(false)
          }, 2000)
        }}
        style={{marginLeft: -40}}
      />
    </>
  ) : null

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onShowInfoPanel = React.useCallback(() => showInfoPanel(true, undefined), [showInfoPanel])
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = React.useCallback(() => {
    // fix a race with the keyboard going away and coming back quickly
    Keyboard.dismiss()
    setTimeout(() => {
      toggleThreadSearch()
    }, 100)
  }, [toggleThreadSearch])
  return pendingWaiting ? null : (
    <Kb.Box2 direction="horizontal" gap="small">
      {dumpIcon}
      <Kb.Icon type="iconfont-search" onClick={onToggleThreadSearch} />
      <Kb.Icon type="iconfont-info" onClick={onShowInfoPanel} />
    </Kb.Box2>
  )
}

enum HeaderType {
  Team,
  PhoneEmail,
  User,
}

const HeaderBranchContainer = React.memo(function HeaderBranchContainer() {
  const participantInfo = C.useChatContext(s => s.participants)
  const type = C.useChatContext(s => {
    const meta = s.meta
    const teamName = meta.teamname
    if (teamName) {
      return HeaderType.Team
    }
    const participants = meta.teamname ? null : participantInfo.name
    const isPhoneOrEmail =
      participants?.some(participant => participant.endsWith('@phone') || participant.endsWith('@email')) ??
      false
    return isPhoneOrEmail ? HeaderType.PhoneEmail : HeaderType.User
  })

  switch (type) {
    case HeaderType.Team:
      return <ChannelHeader />
    case HeaderType.PhoneEmail:
      return <PhoneOrEmailHeader />
    case HeaderType.User:
      return <UsernameHeader />
  }
})
export default HeaderBranchContainer

const BadgeHeaderLeftArray = ({...rest}: any) => {
  const visiblePath = C.getVisiblePath()
  const onTopOfInbox = visiblePath?.[(visiblePath.length ?? 0) - 2]?.name === 'chatRoot'
  const badgeCountsChanged = C.useChatState(s => s.badgeCountsChanged)
  const conversationIDKey = C.useChatContext(s => s.id)
  const badgeNumber = React.useMemo(() => {
    if (!onTopOfInbox) return 0
    const badgeMap = C.useChatState.getState().getBadgeMap(badgeCountsChanged)
    return [...badgeMap.entries()].reduce(
      (res, [currentConvID, currentValue]) =>
        // only show sum of badges that aren't for the current conversation
        currentConvID !== conversationIDKey ? res + currentValue : res,
      0
    )
  }, [badgeCountsChanged, onTopOfInbox, conversationIDKey])
  return <HeaderLeftArrow badgeNumber={badgeNumber} {...rest} />
}

export const headerNavigationOptions = (route: unknown) => {
  const conversationIDKey =
    getRouteParamsFromRoute<'chatConversation'>(route)?.conversationIDKey ?? C.noConversationIDKey
  return {
    headerLeft: (props: any) => {
      const {onLabelLayout, labelStyle, ...rest} = props
      return (
        <C.ChatProvider id={conversationIDKey}>
          <BadgeHeaderLeftArray {...rest} />
        </C.ChatProvider>
      )
    },
    headerRight: () => (
      <C.ChatProvider id={conversationIDKey}>
        <HeaderAreaRight />
      </C.ChatProvider>
    ),
    headerTitle: () => (
      <C.ChatProvider id={conversationIDKey}>
        <HeaderBranchContainer />
      </C.ChatProvider>
    ),
  }
}
