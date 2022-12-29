// import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Tabs from '../../../constants/tabs'
import type * as Types from '../../../constants/types/chat2'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader} from './index.native'
import {HeaderLeftArrow} from '../../../common-adapters/header-hoc'
import {getVisiblePath} from '../../../constants/router2'
// import {Alert} from 'react-native'
// import {DEBUGDump as DEBUGDumpView} from '../list-area/index.native'
// import {DEBUGDump as DEBUGDumpStore} from '../../../store/configure-store'
import {getRouteParamsFromRoute} from '../../../router-v2/route-params'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

// const DEBUGCHATMAYBE = (gotoNav: () => void) => {
//   if (!Constants.DEBUG_CHAT_DUMP) {
//     return
//   }
//   Alert.alert(
//     'Send chat debug info?',
//     'This is temporary tool to do a log send for chats. This will log extra info to the server, is this ok? After this you MUST log send',
//     [
//       {
//         onPress: () => {
//           const conversationIDKey = DEBUGDumpView()
//           DEBUGDumpStore(conversationIDKey ?? '')
//           gotoNav()
//         },
//         text: 'Ok',
//       },
//       {text: 'Nope'},
//     ]
//   )
// }

export const HeaderAreaRight = (props: OwnProps) => {
  const {conversationIDKey} = props
  const pendingWaiting =
    conversationIDKey === Constants.pendingWaitingConversationIDKey ||
    conversationIDKey === Constants.pendingErrorConversationIDKey

  const dispatch = Container.useDispatch()

  const onShowInfoPanel = React.useCallback(
    () => dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
    [dispatch, conversationIDKey]
  )
  const onToggleThreadSearch = React.useCallback(
    () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    [dispatch, conversationIDKey]
  )
  // const onLongPress = React.useCallback(() => {
  //   if (!Constants.DEBUG_CHAT_DUMP) {
  //     return
  //   }
  //   DEBUGCHATMAYBE(() => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsTabs.feedbackTab']})))
  // }, [dispatch])
  return pendingWaiting ? null : (
    <Kb.Box2 direction="horizontal" gap="small">
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
