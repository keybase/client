import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader, Props} from './index.native'
import {HeaderLeftArrow} from '../../../common-adapters/header-hoc'
import * as Container from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {getVisiblePath} from '../../../constants/router2'
import {getFullname} from '../../../constants/users'
import * as Tabs from '../../../constants/tabs'

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
  return pendingWaiting ? null : (
    <Kb.Box2 direction="horizontal" gap="small">
      <Kb.Icon type="iconfont-search" onClick={onToggleThreadSearch} />
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

    console.log('aaa header area container', meta)

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
    onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
    onShowInfoPanel: () => dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
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

export const headerNavigationOptions = route => ({
  headerLeft: props => (
    <BadgeHeaderLeftArray {...props} conversationIDKey={route.params?.conversationIDKey} />
  ),
  headerRight: () => <HeaderAreaRight conversationIDKey={route.params?.conversationIDKey} />,
  headerTitle: () => <HeaderArea conversationIDKey={route.params?.conversationIDKey} />,
})

export default HeaderArea
