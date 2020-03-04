import * as BotConstants from '../../../constants/bots'
import * as React from 'react'
import * as TeamConstants from '../../../constants/teams'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'

type AddToChannelProps = {
  conversationIDKey: Types.ConversationIDKey
  username: string
}

const AddToChannel = (props: AddToChannelProps) => {
  const {conversationIDKey, username} = props
  const dispatch = Container.useDispatch()
  const settings = Container.useSelector(
    state => state.chat2.botSettings.get(conversationIDKey)?.get(username) ?? undefined
  )
  return (
    <Kb.WaitingButton
      disabled={!settings}
      type="Dim"
      mode="Secondary"
      icon="iconfont-new"
      tooltip="Add to this channel"
      onClick={e => {
        e.preventDefault()
        // if settings aren't loaded, don't even try to do anything
        if (settings && !settings.convs?.includes(conversationIDKey)) {
          dispatch(
            Chat2Gen.createEditBotSettings({
              allowCommands: settings.cmds,
              allowMentions: settings.mentions,
              conversationIDKey,
              convs: [conversationIDKey].concat(settings.convs ?? []),
              username,
            })
          )
        }
      }}
      waitingKey={Constants.waitingKeyBotAdd}
    />
  )
}

type BotProps = RPCTypes.FeaturedBot & {
  description?: string
  firstItem?: boolean
  showChannelAdd?: boolean
  showTeamAdd?: boolean
  conversationIDKey?: Types.ConversationIDKey
  onClick: (username: string) => void
}
export const Bot = (props: BotProps) => {
  const {botAlias, description, botUsername} = props
  const {ownerTeam, ownerUser} = props
  const {onClick, firstItem} = props
  const {conversationIDKey, showChannelAdd, showTeamAdd} = props
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (conversationIDKey && showChannelAdd) {
      // fetch bot settings if trying to show the add to channel button
      dispatch(Chat2Gen.createRefreshBotSettings({conversationIDKey, username: botUsername}))
    }
  }, [dispatch, botUsername, conversationIDKey, showChannelAdd])

  const lower = (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      gap="xtiny"
      alignSelf="flex-start"
      fullWidth={true}
      style={{flex: 1}}
    >
      {description !== '' && (
        <Kb.Text type="BodySmall" lineClamp={1} onClick={() => onClick(botUsername)}>
          {description}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

  const usernameDisplay = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.black}}>
        {botAlias || botUsername}
      </Kb.Text>
      <Kb.Text type="BodySmall">&nbsp;• by&nbsp;</Kb.Text>
      {ownerTeam ? (
        <Kb.Text type="BodySmall">{`${ownerTeam}`}</Kb.Text>
      ) : (
        <Kb.ConnectedUsernames
          inline={true}
          usernames={[ownerUser ?? botUsername]}
          type="BodySmall"
          withProfileCardPopup={true}
          onUsernameClicked="profile"
        />
      )}
    </Kb.Box2>
  )
  return (
    <Kb.ListItem2
      onClick={() => onClick(botUsername)}
      type="Large"
      firstItem={!!firstItem}
      icon={<Kb.Avatar size={Styles.isMobile ? 48 : 32} style={styles.avatarStyle} username={botUsername} />}
      action={
        showTeamAdd ? (
          <Kb.Button type="Dim" mode="Secondary" icon="iconfont-new" tooltip="Add to this team" />
        ) : showChannelAdd && conversationIDKey ? (
          <AddToChannel conversationIDKey={conversationIDKey} username={botUsername} />
        ) : null
      }
      body={
        <Kb.Box2 direction="vertical" style={styles.container}>
          {usernameDisplay}
          {description ? lower : null}
        </Kb.Box2>
      }
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addBot: {
        alignSelf: undefined,
        marginBottom: Styles.globalMargins.xtiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.small,
      },
      addButton: {marginLeft: Styles.globalMargins.tiny},
      avatarStyle: Styles.platformStyles({
        isElectron: {marginRight: Styles.globalMargins.tiny},
        isMobile: {marginRight: Styles.globalMargins.small},
      }),
      botHeaders: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.tiny,
      },
      container: Styles.platformStyles({
        isElectron: {
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      divider: Styles.platformStyles({
        common: {marginTop: Styles.globalMargins.tiny},
        isElectron: {marginLeft: 56},
        isMobile: {marginLeft: 81},
      }),
      row: {
        alignItems: 'center',
        flex: 1,
        marginRight: Styles.globalMargins.tiny,
      },
      rowContainer: Styles.platformStyles({
        common: {
          minHeight: 48,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
        },
      }),
    } as const)
)

type Props = {
  conversationIDKey: Types.ConversationIDKey
  renderTabs: () => React.ReactNode
  commonSections: Array<unknown>
}

const inThisChannelHeader = 'bots: in this channel'
const inThisTeamHeader = 'bots: in this team'
const featuredBotsHeader = 'bots: featured bots'
const loadMoreBotsButton = 'bots: load more'
const addBotButton = 'bots: add bot'
const featuredBotSpinner = 'bots: featured spinners'

export default (props: Props) => {
  const {renderTabs, conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamID, teamname, teamType, botAliases} = meta
  const yourOperations = Container.useSelector(state =>
    teamname ? TeamConstants.getCanPerformByID(state, teamID) : undefined
  )
  let canManageBots = false
  if (teamname) {
    canManageBots = yourOperations?.manageBots ?? false
  } else {
    canManageBots = true
  }
  const adhocTeam = teamType === 'adhoc'
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID)) ?? new Map()
  const participantsAll = participantInfo.all

  let botUsernames: Array<string> = []
  if (adhocTeam) {
    botUsernames = participantsAll.filter(p => !participantInfo.name.includes(p))
  } else {
    botUsernames = [...teamMembers.values()]
      .filter(
        p =>
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'restrictedbot') ||
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }

  const featuredBotsMap = Container.useSelector(state => state.chat2.featuredBotsMap)
  const featuredBots = BotConstants.getFeaturedSorted(featuredBotsMap)
    .filter(
      k =>
        !botUsernames.includes(k.botUsername) &&
        !(!adhocTeam && TeamConstants.userInTeamNotBotWithInfo(teamMembers, k.botUsername))
    )
    .map((bot, index) => ({...bot, index}))
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const loadedAllBots = Container.useSelector(state => state.chat2.featuredBotsLoaded)

  const usernamesToFeaturedBots = (usernames: string[]) =>
    usernames.map((b, index) => ({
      ...(featuredBotsMap.get(b) ?? {
        botAlias: botAliases[b] ?? (infoMap.get(b) || {fullname: ''}).fullname,
        botUsername: b,
        description: infoMap.get(b)?.bio ?? '',
        extendedDescription: '',
        extendedDescriptionRaw: '',
        isPromoted: false,
        rank: 0,
      }),
      index,
    }))

  // bots in conv
  const botsInConv: string[] =
    teamType === 'big' ? botUsernames.filter(b => participantsAll.includes(b)) : botUsernames

  const botsInTeam: string[] = botUsernames.filter(b => !botsInConv.includes(b))

  const onBotAdd = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, namespace: 'chat2'}, selected: 'chatSearchBots'}],
      })
    )
  }
  const onBotSelect = (username: string) => {
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
  }
  const onLoadMoreBots = () => dispatch(Chat2Gen.createLoadNextBotPage({pageSize: 100}))
  const loadingBots = !featuredBotsMap.size

  const featuredBotsLength = featuredBots.length
  React.useEffect(() => {
    if (featuredBotsLength === 0 && !loadedAllBots) {
      dispatch(Chat2Gen.createLoadNextBotPage({pageSize: 100}))
    }
  }, [featuredBotsLength, dispatch, conversationIDKey, loadedAllBots])

  const items = [
    ...(canManageBots ? [addBotButton] : []),
    ...(botsInConv.length > 0 ? [inThisChannelHeader] : []),
    ...usernamesToFeaturedBots(botsInConv),
    ...(botsInTeam.length > 0 ? [inThisTeamHeader] : []),
    ...usernamesToFeaturedBots(botsInTeam),
    featuredBotsHeader,
    ...(featuredBots.length > 0 ? featuredBots : []),
    ...(!loadedAllBots && featuredBots.length > 0 ? [loadMoreBotsButton] : []),
    ...(loadingBots ? [featuredBotSpinner] : []),
  ]

  const sections = [
    {
      data: items,
      key: 'bots',
      keyExtractor: (item: Unpacked<typeof items>, index: number) => {
        if (typeof item === 'string' || item instanceof String) {
          return item
        }
        return item.botUsername ? 'abot-' + item.botUsername : index
      },
      renderItem: ({item}: {item: any}) => {
        if (item === addBotButton) {
          return (
            <Kb.Button
              mode="Secondary"
              type="Default"
              label="Add a bot"
              style={styles.addBot}
              onClick={onBotAdd}
            />
          )
        }
        if (item === inThisChannelHeader) {
          return (
            <Kb.Text type="Header" style={styles.botHeaders}>
              In this conversation
            </Kb.Text>
          )
        }
        if (item === inThisTeamHeader) {
          return (
            <Kb.Text type="Header" style={styles.botHeaders}>
              Installed in this team
            </Kb.Text>
          )
        }
        if (item === featuredBotsHeader) {
          return (
            <Kb.Text type="Header" style={styles.botHeaders}>
              Featured
            </Kb.Text>
          )
        }
        if (item === featuredBotSpinner) {
          return <Kb.ProgressIndicator type="Large" />
        }
        if (item === loadMoreBotsButton) {
          return (
            <Kb.Button
              label="Load more"
              mode="Secondary"
              type="Default"
              style={styles.addBot}
              onClick={onLoadMoreBots}
            />
          )
        }
        if (!item.botUsername) {
          return null
        } else {
          return (
            <Bot
              {...item}
              conversationIDKey={conversationIDKey}
              firstItem={item.index === 0}
              onClick={onBotSelect}
              showChannelAdd={canManageBots && teamType === 'big' && botsInTeam.includes(item.botUsername)}
              showTeamAdd={canManageBots && featuredBots.find(bot => bot.botUsername === item.botUsername)}
            />
          )
        }
      },
      renderSectionHeader: renderTabs,
    },
  ]

  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}: any) => section?.renderSectionHeader?.({section}) ?? null}
      sections={[...props.commonSections, ...sections]}
    />
  )
}
