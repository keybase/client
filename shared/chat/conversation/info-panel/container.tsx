import * as BotConstants from '../../../constants/bots'
import * as BotsGen from '../../../actions/bots-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamConstants from '../../../constants/teams'
import * as TeamTypes from '../../../constants/types/teams'
import * as Types from '../../../constants/types/chat2'
import flags from '../../../util/feature-flags'
import {InfoPanel, Panel, InfoPanelProps} from '.'

type OwnProps = {
  loadDelay?: number
  conversationIDKey: Types.ConversationIDKey
  onBack?: () => void
  onCancel?: () => void
  onSelectTab: (t: Panel) => void
  selectedTab: Panel | null
}

// const loading: Types.AttachmentViewStatus = 'loading'
const noTeamMembers = new Map<string, TeamTypes.MemberInfo>()

const ConnectedInfoPanel = Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.conversationIDKey
    const meta = Constants.getMeta(state, conversationIDKey)

    let canSetMinWriterRole = false
    let canSetRetention = false
    let canManageBots = false
    if (meta.teamname) {
      const yourOperations = TeamConstants.getCanPerformByID(state, meta.teamID)
      canSetMinWriterRole = yourOperations.setMinWriterRole
      canSetRetention = yourOperations.setRetentionPolicy
      canManageBots = yourOperations.manageBots
    } else {
      canManageBots = true
    }
    const isPreview = meta.membershipType === 'youArePreviewing'
    const selectedTab = ownProps.selectedTab || 'members'
    const _teamMembers = state.teams.teamIDToMembers.get(meta.teamID) || noTeamMembers
    const _participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    return {
      _botAliases: meta.botAliases,
      _featuredBots: state.chat2.featuredBotsMap,
      _infoMap: state.users.infoMap,
      _participantInfo,
      _team: meta.teamname,
      _teamMembers,
      _username: state.config.username,
      adhocTeam: meta.teamType === 'adhoc',
      canManageBots,
      canSetMinWriterRole,
      canSetRetention,
      channelname: meta.channelname,
      description: meta.descriptionDecorated,
      isPreview,
      loadedAllBots: state.chat2.featuredBotsLoaded,
      selectedConversationIDKey: conversationIDKey,
      selectedTab,
      smallTeam: meta.teamType !== 'big',
      teamID: meta.teamID,
      teamname: meta.teamname,
    }
  },
  (dispatch: Container.TypedDispatch, {conversationIDKey, onBack, onCancel}: OwnProps) => ({
    _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox()),
    _onEditChannel: (teamID: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, teamID}, selected: 'chatEditChannel'}],
        })
      ),
    _onShowClearConversationDialog: () => {
      dispatch(Chat2Gen.createNavigateToThread())
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
        })
      )
    },
    onBack: onBack
      ? () => {
          onBack()
          dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
        }
      : undefined,
    onBotAdd: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, namespace: 'chat2'}, selected: 'chatSearchBots'}],
        })
      )
    },
    onBotSelect: (username: string) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {botUsername: username, conversationIDKey, namespace: 'chat2'},
              selected: 'chatInstallBot',
            },
          ],
        })
      )
    },
    onCancel: onCancel
      ? () => {
          onCancel()
          dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
        }
      : undefined,
    onLoadMoreBots: () => dispatch(Chat2Gen.createLoadNextBotPage({pageSize: 100})),
    onSearchFeaturedBots: (query: string) => dispatch(BotsGen.createSearchFeaturedBots({query})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    let participants = stateProps._participantInfo.all
    let botUsernames: Array<string> = []
    if (stateProps.adhocTeam) {
      botUsernames = participants.filter(p => !stateProps._participantInfo.name.includes(p))
    } else {
      botUsernames = [...stateProps._teamMembers.values()]
        .filter(
          p =>
            TeamConstants.userIsRoleInTeamWithInfo(stateProps._teamMembers, p.username, 'restrictedbot') ||
            TeamConstants.userIsRoleInTeamWithInfo(stateProps._teamMembers, p.username, 'bot')
        )
        .map(p => p.username)
        .sort((l, r) => l.localeCompare(r))
    }

    const shouldFilterBots = stateProps.smallTeam
    participants =
      flags.botUI && shouldFilterBots ? participants.filter(p => !botUsernames.includes(p)) : participants

    const installedBots: Array<RPCTypes.FeaturedBot> = botUsernames.map(
      b =>
        stateProps._featuredBots.get(b) ?? {
          botAlias: stateProps._botAliases[b] ?? (stateProps._infoMap.get(b) || {fullname: ''}).fullname,
          botUsername: b,
          description: stateProps._infoMap.get(b)?.bio ?? '',
          extendedDescription: '',
          isPromoted: false,
          rank: 0,
        }
    )

    const loadingBots = !stateProps._featuredBots.size
    const featuredBots = BotConstants.getFeaturedSorted(stateProps._featuredBots).filter(
      k =>
        !botUsernames.includes(k.botUsername) &&
        !(
          !stateProps.adhocTeam &&
          TeamConstants.userInTeamNotBotWithInfo(stateProps._teamMembers, k.botUsername)
        )
    )

    // const teamMembers = stateProps._teamMembers
    const p: InfoPanelProps = {
      canManageBots: stateProps.canManageBots,
      canSetMinWriterRole: stateProps.canSetMinWriterRole,
      canSetRetention: stateProps.canSetRetention,
      channelname: stateProps.channelname,
      customCancelText: 'Done',
      description: stateProps.description,
      featuredBots,
      installedBots,
      isPreview: stateProps.isPreview,
      loadDelay: ownProps.loadDelay,
      loadedAllBots: stateProps.loadedAllBots,
      loadingBots,
      onBack: dispatchProps.onBack,
      onBotAdd: dispatchProps.onBotAdd,
      onBotSelect: dispatchProps.onBotSelect,
      onCancel: dispatchProps.onCancel,
      onEditChannel: () => dispatchProps._onEditChannel(stateProps.teamID),
      onLoadMoreBots: dispatchProps.onLoadMoreBots,
      onSearchFeaturedBots: dispatchProps.onSearchFeaturedBots,
      onSelectTab: ownProps.onSelectTab,
      selectedConversationIDKey: stateProps.selectedConversationIDKey,
      selectedTab: stateProps.selectedTab,
      smallTeam: stateProps.smallTeam,
      teamID: stateProps.teamID,
      teamname: stateProps.teamname,
    }
    return p
  }
)(InfoPanel)

type SelectorOwnProps =
  | Container.RouteProps<{
      conversationIDKey: Types.ConversationIDKey
      tab: Panel | null
      attachmentview: RPCChatTypes.GalleryItemTyp
    }>
  | {}

type Props = {
  conversationIDKey: Types.ConversationIDKey
  initialTab: Panel | null
  onBack: () => void
  onGoToInbox: () => void
  shouldNavigateOut: boolean
}

const InfoPanelSelector = (props: Props) => {
  const {shouldNavigateOut, onGoToInbox} = props
  const prevShouldNavigateOut = Container.usePrevious(props.shouldNavigateOut)
  React.useEffect(() => {
    !prevShouldNavigateOut && shouldNavigateOut && onGoToInbox()
  }, [prevShouldNavigateOut, shouldNavigateOut, onGoToInbox])
  const [selectedTab, onSelectTab] = React.useState<Panel | null>(props.initialTab)
  if (!props.conversationIDKey) {
    return null
  }

  return (
    <ConnectedInfoPanel
      onBack={undefined}
      onCancel={props.onBack}
      conversationIDKey={props.conversationIDKey}
      onSelectTab={onSelectTab}
      selectedTab={selectedTab}
    />
  )
}

const InfoConnected = Container.connect(
  (state, ownProps: SelectorOwnProps) => {
    const conversationIDKey: Types.ConversationIDKey =
      // @ts-ignore
      typeof ownProps.navigation !== 'undefined'
        ? Container.getRouteProps(ownProps as any, 'conversationIDKey', Constants.noConversationIDKey)
        : state.chat2.selectedConversation

    const meta = Constants.getMeta(state, conversationIDKey)
    return {
      _panel: state.chat2.infoPanelSelectedTab,
      conversationIDKey,
      shouldNavigateOut: meta.conversationIDKey === Constants.noConversationIDKey,
    }
  },
  dispatch => ({
    // Used by HeaderHoc.
    onBack: () => dispatch(Chat2Gen.createShowInfoPanel({show: false})),
    onGoToInbox: () => dispatch(Chat2Gen.createNavigateToInbox()),
  }),
  (stateProps, dispatchProps, ownProps: SelectorOwnProps) => ({
    conversationIDKey: stateProps.conversationIDKey,
    initialTab:
      // @ts-ignore
      typeof ownProps.navigation !== 'undefined'
        ? Container.getRouteProps(
            // @ts-ignore
            ownProps,
            'tab',
            null
          )
        : stateProps._panel,
    onBack: dispatchProps.onBack,
    onGoToInbox: dispatchProps.onGoToInbox,
    shouldNavigateOut: stateProps.shouldNavigateOut,
  })
)(InfoPanelSelector)

export default InfoConnected
