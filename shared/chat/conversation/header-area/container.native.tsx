import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import {DebugChatDumpContext} from '../../../constants/chat2/debug'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Tabs from '../../../constants/tabs'
import type * as Types from '../../../constants/types/chat2'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader} from './index.native'
import {HeaderLeftArrow} from '../../../common-adapters/header-hoc'
import {getVisiblePath} from '../../../constants/router2'
import {getRouteParamsFromRoute} from '../../../router-v2/route-params'
import {Keyboard} from 'react-native'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export const HeaderAreaRight = (props: OwnProps) => {
  const {conversationIDKey} = props
  const pendingWaiting =
    conversationIDKey === Constants.pendingWaitingConversationIDKey ||
    conversationIDKey === Constants.pendingErrorConversationIDKey

  const dispatch = Container.useDispatch()

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

  const onShowInfoPanel = React.useCallback(
    () => dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
    [dispatch, conversationIDKey]
  )
  const onToggleThreadSearch = React.useCallback(() => {
    // fix a race with the keyboard going away and coming back quickly
    Keyboard.dismiss()
    setTimeout(() => {
      dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
    }, 100)
  }, [dispatch, conversationIDKey])
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

const HeaderBranchContainer = React.memo(function HeaderBranchContainer(p: OwnProps) {
  const {conversationIDKey} = p
  const type = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const teamName = meta.teamname
    if (teamName) {
      return HeaderType.Team
    }
    const participants = meta.teamname ? null : Constants.getParticipantInfo(state, conversationIDKey).name
    const isPhoneOrEmail =
      participants?.some(participant => participant.endsWith('@phone') || participant.endsWith('@email')) ??
      false
    return isPhoneOrEmail ? HeaderType.PhoneEmail : HeaderType.User
  })

  switch (type) {
    case HeaderType.Team:
      return <ChannelHeader conversationIDKey={conversationIDKey} />
    case HeaderType.PhoneEmail:
      return <PhoneOrEmailHeader conversationIDKey={conversationIDKey} />
    case HeaderType.User:
      return <UsernameHeader conversationIDKey={conversationIDKey} />
  }
})
export default HeaderBranchContainer

const BadgeHeaderLeftArray = ({conversationIDKey, ...rest}) => {
  const visiblePath = getVisiblePath()
  const onTopOfInbox = visiblePath?.length === 3 && visiblePath[1]?.name === Tabs.chatTab
  const badgeNumber = Container.useSelector(state =>
    onTopOfInbox
      ? [...state.chat2.badgeMap.entries()].reduce(
          (res, [currentConvID, currentValue]) =>
            // only show sum of badges that aren't for the current conversation
            currentConvID !== conversationIDKey ? res + currentValue : res,
          0
        )
      : 0
  )
  return <HeaderLeftArrow badgeNumber={badgeNumber} {...rest} />
}

export const headerNavigationOptions = (route: unknown) => {
  const conversationIDKey =
    getRouteParamsFromRoute<'chatConversation'>(route)?.conversationIDKey ?? Constants.noConversationIDKey
  return {
    headerLeft: (props: any) => {
      const {onLabelLayout, labelStyle, ...rest} = props
      return <BadgeHeaderLeftArray {...rest} conversationIDKey={conversationIDKey} />
    },
    headerRight: () => <HeaderAreaRight conversationIDKey={conversationIDKey} />,
    headerTitle: () => <HeaderBranchContainer conversationIDKey={conversationIDKey} />,
  }
}
