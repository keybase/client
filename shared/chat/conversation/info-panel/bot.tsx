import * as C from '@/constants'
import * as ChatCommon from '@/constants/chat/common'
import * as Teams from '@/constants/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {getFeaturedSorted, useFeaturedBotPage} from '@/util/featured-bots'
import {useUsersState} from '@/stores/users'
import {useChatTeam, useChatTeamMembers} from '../team-hooks'
import logger from '@/logger'
import {useBotSettings} from '../bot/settings'
import {getInboxConversationMeta, participantInfoReceived} from '@/chat/inbox/metadata'
import {useConversationMetadata} from '../data-hooks'

type AddToChannelProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  username: string
}

const inThisChannelHeader = {type: 'bots: in this channel'} as const
const inThisTeamHeader = {type: 'bots: in this team'} as const
const featuredBotsHeader = {type: 'bots: featured bots'} as const
const loadMoreBotsButton = {type: 'bots: load more'} as const
const addBotButton = {type: 'bots: add bot'} as const
const featuredBotSpinner = {type: 'bots: featured spinners'} as const

type ItemBot = {type: 'featuredBot'} & T.RPCGen.FeaturedBot
type Item =
  | ItemBot
  | {type: 'header-item'}
  | {type: 'tabs'}
  | typeof inThisChannelHeader
  | typeof inThisTeamHeader
  | typeof featuredBotsHeader
  | typeof loadMoreBotsButton
  | typeof addBotButton
  | typeof featuredBotSpinner

type Section = Kb.SectionType<Item>

const AddToChannel = (props: AddToChannelProps) => {
  const {conversationIDKey, username} = props
  const {settings, setSettings} = useBotSettings(conversationIDKey, username)
  const editBotSettings = C.useRPC(T.RPCChat.localSetBotMemberSettingsRpcPromise)
  const previewConversationByID = C.useRPC(T.RPCChat.localPreviewConversationByIDLocalRpcPromise)
  return (
    <Kb.WaitingButton
      disabled={!settings}
      type="Dim"
      mode="Secondary"
      tooltip="Add to this channel"
      onClick={e => {
        e.preventDefault()
        // if settings aren't loaded, don't even try to do anything
        if (settings && !settings.convs?.includes(conversationIDKey)) {
          const nextSettings = {
            cmds: settings.cmds,
            convs: [conversationIDKey].concat(settings.convs ?? []),
            mentions: settings.mentions,
          }
          editBotSettings(
            [
              {
                botSettings: nextSettings,
                convID: T.Chat.keyToConversationID(conversationIDKey),
                username,
              },
              C.waitingKeyChatBotAdd,
            ],
            () => {
              setSettings(nextSettings)
              previewConversationByID(
                [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
                preview => {
                  participantInfoReceived(
                    conversationIDKey,
                    ChatCommon.uiParticipantsToParticipantInfo(preview.conv.participants ?? []),
                    getInboxConversationMeta(conversationIDKey)
                  )
                },
                () => {}
              )
            },
            error => {
              logger.info(`AddToChannel: failed to edit bot settings: ${error.message}`)
            }
          )
        }
      }}
      waitingKey={C.waitingKeyChatBotAdd}
    >
      <Kb.Icon type="iconfont-new" sizeType="Small" color={Kb.Styles.globalColors.black} />
    </Kb.WaitingButton>
  )
}

type BotProps = T.RPCGen.FeaturedBot & {
  description?: string
  firstItem?: boolean
  hideHover?: boolean
  isSelected?: boolean
  showChannelAdd?: boolean
  showTeamAdd?: boolean
  conversationIDKey?: T.Chat.ConversationIDKey
  onClick: (username: string) => void
}
export const Bot = (props: BotProps) => {
  const {botAlias, description, botUsername} = props
  const {ownerTeam, ownerUser} = props
  const {onClick, firstItem, isSelected} = props
  const {conversationIDKey, showChannelAdd, showTeamAdd} = props
  const primaryColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black
  const secondaryColor = isSelected ? Kb.Styles.globalColors.white : undefined

  const lower = (
    <Kb.Box2 alignSelf="flex-start" direction="horizontal" fullWidth={true}>
      {description !== '' && (
        <Kb.Text
          type="BodySmall"
          lineClamp={1}
          style={secondaryColor ? {color: secondaryColor} : undefined}
          onClick={() => onClick(botUsername)}
        >
          {description}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

  const usernameDisplay = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      <Kb.Text type="BodySmall" lineClamp={1}>
        <Kb.Text type="BodySmallSemibold" style={{color: primaryColor}}>
          {botAlias || botUsername}
        </Kb.Text>
        <Kb.Text type="BodySmall" style={secondaryColor ? {color: secondaryColor} : undefined}>
          &nbsp;• by&nbsp;
        </Kb.Text>
        {ownerTeam ? (
          <Kb.Text type="BodySmall" style={secondaryColor ? {color: secondaryColor} : undefined}>
            {`${ownerTeam}`}
          </Kb.Text>
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
    <Kb.ListItem
      containerStyleOverride={styles.listItemContainer}
      onClick={() => onClick(botUsername)}
      type="Large"
      firstItem={!!firstItem}
      icon={<Kb.Avatar size={isMobile ? 48 : 32} username={botUsername} />}
      hideHover={!!props.hideHover}
      style={{backgroundColor: isSelected ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.white}}
      action={
        showTeamAdd ? (
          <Kb.IconButton type="Dim" mode="Secondary" icon="iconfont-new" tooltip="Add to this team" />
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addBot: {
        alignSelf: undefined,
        marginBottom: Kb.Styles.globalMargins.xtiny,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      botHeaders: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          marginRight: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          marginRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      listItemContainer: {paddingRight: Kb.Styles.globalMargins.tiny},
    }) as const
)

type Props = {
  commonSections: ReadonlyArray<Section>
  conversationIDKey: T.Chat.ConversationIDKey
}

const BotTab = (props: Props) => {
  const {conversationIDKey} = props
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const {teamID, teamname, teamType, botAliases} = meta
  const {yourOperations} = useChatTeam(teamID, teamname)
  const canManageBots = teamname ? yourOperations.manageBots : true
  const adhocTeam = teamType === 'adhoc'
  const {members: teamMembers, reload: reloadTeamMembers} = useChatTeamMembers(teamID)
  const previewConversationByID = C.useRPC(T.RPCChat.localPreviewConversationByIDLocalRpcPromise)
  const mutationWaiting = C.Waiting.useAnyWaiting([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
  const mutationError = C.Waiting.useAnyErrors([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
  const wasMutationWaitingRef = React.useRef(mutationWaiting)
  const repairedAdhocParticipantsRef = React.useRef<T.Chat.ConversationIDKey | undefined>(undefined)
  const participantsAll = participantInfo.all
  React.useEffect(() => {
    if (
      !adhocTeam ||
      participantInfo.name.length > 0 ||
      participantsAll.length === 0 ||
      repairedAdhocParticipantsRef.current === conversationIDKey ||
      !T.Chat.isValidConversationIDKey(conversationIDKey)
    ) {
      return
    }
    repairedAdhocParticipantsRef.current = conversationIDKey
    previewConversationByID(
      [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
      preview => {
        participantInfoReceived(
          conversationIDKey,
          ChatCommon.uiParticipantsToParticipantInfo(preview.conv.participants ?? []),
          getInboxConversationMeta(conversationIDKey)
        )
      },
      () => {}
    )
  }, [
    adhocTeam,
    conversationIDKey,
    participantInfo.name.length,
    participantsAll.length,
    previewConversationByID,
  ])

  React.useEffect(() => {
    const mutationJustFinished = wasMutationWaitingRef.current && !mutationWaiting
    wasMutationWaitingRef.current = mutationWaiting
    if (!mutationJustFinished || mutationError || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
      return
    }
    previewConversationByID(
      [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
      preview => {
        participantInfoReceived(
          conversationIDKey,
          ChatCommon.uiParticipantsToParticipantInfo(preview.conv.participants ?? []),
          getInboxConversationMeta(conversationIDKey)
        )
      },
      () => {}
    )
    if (!adhocTeam) {
      C.ignorePromise(reloadTeamMembers())
    }
  }, [
    adhocTeam,
    conversationIDKey,
    mutationError,
    mutationWaiting,
    previewConversationByID,
    reloadTeamMembers,
  ])

  let botUsernames: Array<string> = []
  if (adhocTeam) {
    botUsernames = participantsAll.filter(p => !participantInfo.name.includes(p))
  } else {
    botUsernames = [...teamMembers.values()]
      .filter(
        p =>
          Teams.userIsRoleInTeamWithInfo(teamMembers, p.username, 'restrictedbot') ||
          Teams.userIsRoleInTeamWithInfo(teamMembers, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }

  const {featuredBots: loadedFeaturedBots, loadedAllBots, loadNextBotPage, loadingBots} = useFeaturedBotPage()
  const featuredBotsMap = new Map(loadedFeaturedBots.map(bot => [bot.botUsername, bot] as const))
  const featuredBots: Array<Item> = getFeaturedSorted(loadedFeaturedBots)
    .filter(
      k =>
        !botUsernames.includes(k.botUsername) &&
        (adhocTeam || !Teams.userInTeamNotBotWithInfo(teamMembers, k.botUsername))
    )
    .map((bot, index) => ({...bot, index, type: 'featuredBot'}))
  const infoMap = useUsersState(s => s.infoMap)

  const usernamesToFeaturedBots = (usernames: string[]): Array<ItemBot> =>
    usernames.map(
      (b, index) =>
        ({
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
          type: 'featuredBot',
        }) as const
    )

  // bots in conv
  const botsInConv: string[] =
    teamType === 'big' ? botUsernames.filter(b => participantsAll.includes(b)) : botUsernames

  const botsInTeam: string[] = botUsernames.filter(b => !botsInConv.includes(b))

  const navigateAppend = C.Router2.navigateAppend
  const onBotAdd = () => {
    navigateAppend({name: 'chatSearchBots', params: {conversationIDKey}})
  }
  const onBotSelect = (username: string) => {
    navigateAppend({
      name: 'chatInstallBot',
      params: {botUsername: username, conversationIDKey},
    })
  }

  const items: Array<Item> = [
    ...(canManageBots ? ([addBotButton] as const) : []),
    ...(botsInConv.length > 0 ? ([inThisChannelHeader] as const) : []),
    ...usernamesToFeaturedBots(botsInConv),
    ...(botsInTeam.length > 0 ? ([inThisTeamHeader] as const) : []),
    ...usernamesToFeaturedBots(botsInTeam),
    featuredBotsHeader,
    ...featuredBots,
    ...(!loadedAllBots && featuredBots.length > 0 ? ([loadMoreBotsButton] as const) : []),
    ...(loadingBots ? ([featuredBotSpinner] as const) : []),
  ]

  const sections: Array<Section> = [
    {
      data: items,
      keyExtractor: (item: Item, index: number) => {
        switch (item.type) {
          case 'featuredBot':
            return item.botUsername ? 'abot-' + item.botUsername : String(index)
          default:
            return String(item.type)
        }
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
              onClick={loadNextBotPage}
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
              showTeamAdd={
                canManageBots &&
                !!featuredBots.find(bot =>
                  bot.type === 'featuredBot' ? bot.botUsername === i.botUsername : false
                )
              }
            />
          )
        }
      },
    },
  ]

  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      sections={[...props.commonSections, ...sections]}
    />
  )
}
export default BotTab
