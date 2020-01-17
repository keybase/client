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
import flags from '../../../util/feature-flags'

type BotProps = RPCTypes.FeaturedBot & {
  conversationIDKey?: Types.ConversationIDKey
  description?: string
  onClick: (username: string) => void
  showAddToChannel?: boolean
}

type AddButtonProps = {
  conversationIDKey: Types.ConversationIDKey
  username: string
}

const AddBotToChannel = ({conversationIDKey, username}: AddButtonProps) => {
  const dispatch = Container.useDispatch()
  const addToChannel = () => dispatch(Chat2Gen.createAddUserToChannel({conversationIDKey, username}))
  return (
    <Kb.WaitingButton
      type="Dim"
      mode="Secondary"
      onClick={(e: React.BaseSyntheticEvent) => {
        e.stopPropagation()
        addToChannel()
      }}
      style={styles.addButton}
      icon="iconfont-new"
      tooltip="Add to this channel"
      waitingKey={Constants.waitingKeyAddUserToChannel(username, conversationIDKey)}
    />
  )
}

export const Bot = (props: BotProps) => {
  const {botAlias, conversationIDKey, description, botUsername, showAddToChannel, onClick} = props
  const {ownerTeam, ownerUser} = props
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
        <Kb.Text type="BodySmall">{`@${ownerTeam}`}</Kb.Text>
      ) : (
        <Kb.ConnectedUsernames
          prefix="@"
          inline={true}
          usernames={[ownerUser ?? botUsername]}
          type="BodySmall"
          withProfileCardPopup={true}
        />
      )}
    </Kb.Box2>
  )
  return (
    <Kb.ClickableBox onClick={() => onClick(botUsername)}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
            <Kb.Avatar size={Styles.isMobile ? 48 : 32} style={styles.avatarStyle} username={botUsername} />
            <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
              {usernameDisplay}
              {lower}
            </Kb.Box2>
            {showAddToChannel && conversationIDKey && (
              <AddBotToChannel username={botUsername} conversationIDKey={conversationIDKey} />
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Divider style={styles.divider} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addBot: {
        marginBottom: Styles.globalMargins.xtiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.small,
      },
      botHeaders: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.tiny,
      },
      addButton: {
        marginLeft: Styles.globalMargins.tiny,
      },
      avatarStyle: Styles.platformStyles({
        isElectron: {marginRight: Styles.globalMargins.tiny},
        isMobile: {marginRight: Styles.globalMargins.small},
      }),
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
        common: {
          marginTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: 56,
        },
        isMobile: {
          marginLeft: 81,
        },
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
const featuredBotsHeader = 'bots: featured bots'
const loadMoreBotsButton = 'bots: load more'
const addBotButton = 'bots: add bot'
const featuredBotSpinner = 'bots: featured spinners'

export default (p: Props) => {
  const {renderTabs, conversationIDKey} = p
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
  const smallTeam = teamType !== 'big'

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

  const participants =
    flags.botUI && smallTeam ? participantsAll.filter(p => !botUsernames.includes(p)) : participantsAll

  const featuredBotsMap = Container.useSelector(state => state.chat2.featuredBotsMap)
  const featuredBots = BotConstants.getFeaturedSorted(featuredBotsMap).filter(
    k =>
      !botUsernames.includes(k.botUsername) &&
      !(!adhocTeam && TeamConstants.userInTeamNotBotWithInfo(teamMembers, k.botUsername))
  )
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const loadedAllBots = Container.useSelector(state => state.chat2.featuredBotsLoaded)

  const installedBots: Array<RPCTypes.FeaturedBot> = botUsernames.map(
    b =>
      featuredBotsMap.get(b) ?? {
        botAlias: botAliases[b] ?? (infoMap.get(b) || {fullname: ''}).fullname,
        botUsername: b,
        description: infoMap.get(b)?.bio ?? '',
        extendedDescription: '',
        isPromoted: false,
        rank: 0,
      }
  )

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

  const sections = [
    {
      data: [
        ...(canManageBots ? [addBotButton] : []),
        ...(installedBots.length > 0 ? [inThisChannelHeader] : []),
        ...installedBots,
        featuredBotsHeader,
        ...(featuredBots.length > 0 ? featuredBots : []),
        ...(!loadedAllBots && featuredBots.length > 0 ? [loadMoreBotsButton] : []),
        ...(loadingBots ? [featuredBotSpinner] : []),
      ],
      renderItem: ({item}) => {
        if (item === addBotButton) {
          return (
            <Kb.Button
              mode="Primary"
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
              {teamname ? 'Installed in this team' : 'In this conversation'}
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
              onClick={onBotSelect}
              showAddToChannel={
                installedBots.includes(item) && !smallTeam && !participants.find(p => p === item.botUsername)
              }
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
      renderSectionHeader={({section}) => section?.renderSectionHeader?.({section}) ?? null}
      sections={[...p.commonSections, ...sections]}
    />
  )
}
