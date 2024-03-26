import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader, useBackBadge} from './index.native'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
import {HeaderLeftArrow} from '@/common-adapters/header-hoc'
import {Keyboard} from 'react-native'
import {getRouteParamsFromRoute} from '@/router-v2/route-params'
// import {DebugChatDumpContext} from '@/constants/chat2/debug'

export const HeaderAreaRight = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const pendingWaiting =
    conversationIDKey === C.Chat.pendingWaitingConversationIDKey ||
    conversationIDKey === C.Chat.pendingErrorConversationIDKey

  // const {chatDebugDump} = React.useContext(DebugChatDumpContext)
  // const [showToast, setShowToast] = React.useState(false)
  // const dumpIcon = chatDebugDump ? (
  //   <>
  //     <Kb.SimpleToast iconType="iconfont-check" text="Logged, send feedback next" visible={showToast} />
  //     <Kb.Icon
  //       type="iconfont-keybase"
  //       onClick={() => {
  //         chatDebugDump(conversationIDKey)
  //         setShowToast(true)
  //         setTimeout(() => {
  //           setShowToast(false)
  //         }, 2000)
  //       }}
  //       style={{zIndex: 999}}
  //     />
  //   </>
  // ) : null

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
      {/* {dumpIcon} */}
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
    const participants = participantInfo.name
    const isPhoneOrEmail = participants.some(
      participant => participant.endsWith('@phone') || participant.endsWith('@email')
    )
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

const BadgeHeaderLeftArray = (p: HeaderBackButtonProps) => {
  const badgeNumber = useBackBadge()
  return <HeaderLeftArrow badgeNumber={badgeNumber} {...p} />
}

export const headerNavigationOptions = (route: unknown) => {
  const conversationIDKey =
    getRouteParamsFromRoute<'chatConversation'>(route)?.conversationIDKey ?? C.Chat.noConversationIDKey
  return {
    headerLeft: (props: HeaderBackButtonProps) => {
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
