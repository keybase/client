import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Styles from '@/styles'
import type * as T from '@/constants/types'
import type {Section as _Section} from '@/common-adapters/section-list'

type AddToChannelProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  username: string
}
type Extra = {renderSectionHeader?: (info: {section: Section}) => React.ReactElement | null}
type Section = _Section<string | T.RPCGen.FeaturedBot, Extra> | _Section<{key: string}, Extra>

const AddToChannel = (props: AddToChannelProps) => {
  const {conversationIDKey, username} = props
  const settings = C.useChatContext(s => s.botSettings.get(username))
  const editBotSettings = C.useChatContext(s => s.dispatch.editBotSettings)
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
          editBotSettings(
            username,
            settings.cmds,
            settings.mentions,
            [conversationIDKey].concat(settings.convs ?? [])
          )
        }
      }}
      waitingKey={C.Chat.waitingKeyBotAdd}
    />
  )
}

type BotProps = T.RPCGen.FeaturedBot & {
  description?: string
  firstItem?: boolean
  hideHover?: boolean
  showChannelAdd?: boolean
  showTeamAdd?: boolean
  conversationIDKey?: T.Chat.ConversationIDKey
  onClick: (username: string) => void
}
export const Bot = (props: BotProps) => {
  const {botAlias, description, botUsername} = props
  const {ownerTeam, ownerUser} = props
  const {onClick, firstItem} = props
  const {conversationIDKey, showChannelAdd, showTeamAdd} = props
  const refreshBotSettings = C.useChatContext(s => s.dispatch.refreshBotSettings)
  C.Chat.useCIDChanged(conversationIDKey, () => {
    if (conversationIDKey && showChannelAdd) {
      // fetch bot settings if trying to show the add to channel button
      refreshBotSettings(botUsername)
    }
  })

  const lower = (
    <Kb.Box2 alignSelf="flex-start" direction="horizontal" fullWidth={true}>
      {description !== '' && (
        <Kb.Text type="BodySmall" lineClamp={1} onClick={() => onClick(botUsername)}>
          {description}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

  const usernameDisplay = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      <Kb.Text type="BodySmall" lineClamp={1}>
        <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.black}}>
          {botAlias || botUsername}
        </Kb.Text>
        <Kb.Text type="BodySmall">&nbsp;• by&nbsp;</Kb.Text>
        {ownerTeam ? (
          <Kb.Text type="BodySmall">{`${ownerTeam}`}</Kb.Text>
        ) : (
          <Kb.ConnectedUsernames
            inline={true}
            usernames={ownerUser ?? botUsername}
            type="BodySmall"
            withProfileCardPopup={true}
            onUsernameClicked="profile"
          />
        )}
      </Kb.Text>
    </Kb.Box2>
  )
  return (
    <Kb.ListItem2
      containerStyleOverride={styles.listItemContainer}
      onClick={() => onClick(botUsername)}
      type="Large"
      firstItem={!!firstItem}
      icon={<Kb.Avatar size={Styles.isMobile ? 48 : 32} username={botUsername} />}
      hideHover={!!props.hideHover}
      style={{backgroundColor: Styles.globalColors.white}}
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
      botHeaders: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.tiny,
      },
      container: Styles.platformStyles({
        isElectron: {
          marginRight: Styles.globalMargins.small,
        },
        isMobile: {
          marginRight: Styles.globalMargins.tiny,
        },
      }),
      divider: Styles.platformStyles({
        common: {marginTop: Styles.globalMargins.tiny},
        isElectron: {marginLeft: 56},
        isMobile: {marginLeft: 81},
      }),
      listItemContainer: {paddingRight: Styles.globalMargins.tiny},
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
    }) as const
)

type Props = {
  renderTabs: () => React.ReactElement | null
  commonSections: Array<Section>
}

const inThisChannelHeader = 'bots: in this channel'
const inThisTeamHeader = 'bots: in this team'
const featuredBotsHeader = 'bots: featured bots'
const loadMoreBotsButton = 'bots: load more'
const addBotButton = 'bots: add bot'
const featuredBotSpinner = 'bots: featured spinners'

const BotTab = (props: Props) => {
  const {renderTabs} = props
  const meta = C.useChatContext(s => s.meta)
  const {teamID, teamname, teamType, botAliases} = meta
  const yourOperations = C.useTeamsState(s => (teamname ? C.Teams.getCanPerformByID(s, teamID) : undefined))
  let canManageBots = false
  if (teamname) {
    canManageBots = yourOperations?.manageBots ?? false
  } else {
    canManageBots = true
  }
  const adhocTeam = teamType === 'adhoc'
  const participantInfo = C.useChatContext(s => s.participants)
  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const participantsAll = participantInfo.all

  let botUsernames: Array<string> = []
  if (adhocTeam) {
    botUsernames = participantsAll.filter(p => !participantInfo.name.includes(p))
  } else if (teamMembers) {
    botUsernames = [...teamMembers.values()]
      .filter(
        p =>
          C.Teams.userIsRoleInTeamWithInfo(teamMembers, p.username, 'restrictedbot') ||
          C.Teams.userIsRoleInTeamWithInfo(teamMembers, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }

  const featuredBotsMap = C.useBotsState(s => s.featuredBotsMap)
  const featuredBots = C.Bots.getFeaturedSorted(featuredBotsMap)
    .filter(
      k =>
        !botUsernames.includes(k.botUsername) &&
        !(!adhocTeam && teamMembers && C.Teams.userInTeamNotBotWithInfo(teamMembers, k.botUsername))
    )
    .map((bot, index) => ({...bot, index}))
  const infoMap = C.useUsersState(s => s.infoMap)
  const loadedAllBots = C.useBotsState(s => s.featuredBotsLoaded)

  const usernamesToFeaturedBots = (usernames: string[]) =>
    usernames.map((b, index) => ({
      ...(featuredBotsMap.get(b) ?? {
        botAlias: botAliases[b] ?? (infoMap.get(b) || {fullname: ''}).fullname ?? '',
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

  const navigateAppend = C.Chat.useChatNavigateAppend()
  const conversationIDKey = C.useChatContext(s => s.id)
  const onBotAdd = () => {
    navigateAppend(conversationIDKey => ({props: {conversationIDKey}, selected: 'chatSearchBots'}))
  }
  const onBotSelect = (username: string) => {
    navigateAppend(conversationIDKey => ({
      props: {botUsername: username, conversationIDKey},
      selected: 'chatInstallBot',
    }))
  }
  const loadNextBotPage = C.useBotsState(s => s.dispatch.loadNextBotPage)
  const onLoadMoreBots = () => loadNextBotPage()
  const loadingBots = !featuredBotsMap.size

  const featuredBotsLength = featuredBots.length
  const [lastFBL, setLastFBL] = React.useState(-1)
  const cidChanged = C.Chat.useCIDChanged(conversationIDKey)
  if (cidChanged || lastFBL !== featuredBotsLength) {
    setLastFBL(featuredBotsLength)
    if (featuredBotsLength === 0 && !loadedAllBots) {
      loadNextBotPage()
    }
  }

  const items: Array<string | T.RPCGen.FeaturedBot> = [
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
      keyExtractor: (item: (typeof items)[number], index: number) => {
        if (typeof item === 'string' || item instanceof String) {
          return item
        }
        return item.botUsername ? 'abot-' + item.botUsername : index
      },
      renderItem: ({item}: {item: unknown}) => {
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

        const i = item as {
          botUsername: string
          index: number
          description?: string
          hideHover?: boolean
        } & T.RPCGen.FeaturedBot
        if (!i.botUsername) {
          return null
        } else {
          return (
            <Bot
              {...i}
              conversationIDKey={conversationIDKey}
              firstItem={i.index === 0}
              onClick={onBotSelect}
              showChannelAdd={canManageBots && teamType === 'big' && botsInTeam.includes(i.botUsername)}
              showTeamAdd={canManageBots && !!featuredBots.find(bot => bot.botUsername === i.botUsername)}
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
      renderSectionHeader={({section}) => section.renderSectionHeader?.({section}) ?? null}
      sections={[...props.commonSections, ...sections]}
    />
  )
}
export default BotTab
