import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader, type Props} from './index.native'
import {HeaderLeftArrow} from '../../../common-adapters/header-hoc'
import * as Container from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {getVisiblePath} from '../../../constants/router2'
import {getFullname} from '../../../constants/users'
import * as Tabs from '../../../constants/tabs'
import {Alert} from 'react-native'
import {DEBUGDump as DEBUGDumpView} from '../list-area/index.native'
import {DEBUGDump as DEBUGDumpStore} from '../../../store/configure-store'
import {getRouteParamsFromRoute} from '../../../router-v2/route-params'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  progress?: any
}

const HeaderBranch = (props: Props & {progress: any}) => {
  const {progress, ...rest} = props

  if (props.teamName) {
    return <ChannelHeader {...rest} />
  }

  const isPhoneOrEmail = props.participants.some(
    participant => participant.endsWith('@phone') || participant.endsWith('@email')
  )

  if (isPhoneOrEmail) {
    return <PhoneOrEmailHeader {...rest} />
  } else {
    return <UsernameHeader {...rest} />
  }
}

const DEBUGCHATMAYBE = (gotoNav: () => void) => {
  if (!Constants.DEBUG_CHAT_DUMP) {
    return
  }
  Alert.alert(
    'Send chat debug info?',
    'This is temporary tool to do a log send for chats. This will log extra info to the server, is this ok? After this you MUST log send',
    [
      {
        onPress: () => {
          const conversationIDKey = DEBUGDumpView()
          DEBUGDumpStore(conversationIDKey ?? '')
          gotoNav()
        },
        text: 'Ok',
      },
      {text: 'Nope'},
    ]
  )
}

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
  const onLongPress = React.useCallback(() => {
    if (!Constants.DEBUG_CHAT_DUMP) {
      return
    }
    DEBUGCHATMAYBE(() => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsTabs.feedbackTab']})))
  }, [dispatch])
  return pendingWaiting ? null : (
    <Kb.Box2 direction="horizontal" gap="small">
      <Kb.Icon type="iconfont-search" onClick={onToggleThreadSearch} onLongPress={onLongPress} />
      <Kb.Icon type="iconfont-info" onClick={onShowInfoPanel} />
    </Kb.Box2>
  )
}

// TODO remove this and connect the sub views
export const HeaderArea = Container.connect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey} = ownProps
    const meta = Constants.getMeta(state, conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const participants = meta.teamname ? null : participantInfo.name
    const contactNames = participantInfo.contactName
    const theirFullname =
      participants?.length === 2
        ? participants
            .filter(username => username !== state.config.username)
            .map(username => getFullname(state, username))[0]
        : undefined

    return {
      channelName: meta.channelname,
      contactNames,
      muted: meta.isMuted,
      participants,
      pendingWaiting:
        conversationIDKey === Constants.pendingWaitingConversationIDKey ||
        conversationIDKey === Constants.pendingErrorConversationIDKey,
      smallTeam: meta.teamType !== 'big',
      teamName: meta.teamname,
      theirFullname,
    }
  },
  (dispatch: Container.TypedDispatch, {conversationIDKey}: OwnProps) => ({
    onOpenFolder: () => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
    onShowInfoPanel: () => dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
    onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
    onToggleThreadSearch: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    unMuteConversation: () => dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {
      channelName,
      contactNames,
      muted,
      participants,
      pendingWaiting,
      smallTeam,
      teamName,
      theirFullname,
    } = stateProps
    const {onOpenFolder, onShowProfile, onShowInfoPanel} = dispatchProps
    const {onToggleThreadSearch, unMuteConversation} = dispatchProps
    return {
      channelName,
      contactNames,
      muted,
      onOpenFolder,
      onShowInfoPanel,
      onShowProfile,
      onToggleThreadSearch,
      participants: participants || [],
      pendingWaiting,
      progress: ownProps.progress,
      smallTeam,
      teamName,
      theirFullname,
      unMuteConversation,
    }
  }
)(HeaderBranch)

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
    headerTitle: () => <HeaderArea conversationIDKey={conversationIDKey} />,
  }
}

export default HeaderArea
