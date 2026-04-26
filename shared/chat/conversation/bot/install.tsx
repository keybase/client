import * as C from '@/constants'
import * as ChatCommon from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import * as Teams from '@/constants/teams'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useModalHeaderState} from '@/stores/modal-header'
import ChannelPicker from './channel-picker'
import {useChatTeam} from '../team-hooks'
import {openURL} from '@/util/misc'
import * as T from '@/constants/types'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'
import {useFeaturedBot} from '@/util/featured-bots'
import type {RPCError} from '@/util/errors'
import logger from '@/logger'

const RestrictedItem = '---RESTRICTED---'

export const useRefreshBotMembershipOnSuccess = (
  conversationIDKey: T.Chat.ConversationIDKey | undefined,
  waitingKey: string,
  error: RPCError | undefined,
  shouldRefreshMembership: boolean,
  onSuccess: () => void
) => {
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const wasWaitingRef = React.useRef(waiting)
  const previewConversationByID = C.useRPC(T.RPCChat.localPreviewConversationByIDLocalRpcPromise)
  const setParticipants = ConvoState.useChatContext(s => s.dispatch.setParticipants)

  React.useEffect(() => {
    if (!waiting && wasWaitingRef.current && !error) {
      if (!shouldRefreshMembership) {
        onSuccess()
      } else if (!conversationIDKey) {
        onSuccess()
      } else {
        previewConversationByID(
          [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
          preview => {
            setParticipants(ChatCommon.uiParticipantsToParticipantInfo(preview.conv.participants ?? []))
            onSuccess()
          },
          () => {
            onSuccess()
          }
        )
      }
    }
    wasWaitingRef.current = waiting
  }, [
    conversationIDKey,
    error,
    onSuccess,
    previewConversationByID,
    setParticipants,
    shouldRefreshMembership,
    waiting,
  ])
}

export const useBotConversationIDKey = (inConvIDKey?: T.Chat.ConversationIDKey, teamID?: T.Teams.TeamID) => {
  const cleanInConvIDKey = T.Chat.isValidConversationIDKey(inConvIDKey ?? '') ? inConvIDKey : undefined
  const [generalConversation, setGeneralConversation] = React.useState<
    | {
        conversationIDKey: T.Chat.ConversationIDKey
        teamID: T.Teams.TeamID
      }
    | undefined
  >()
  const findGeneralConvIDFromTeamID = C.useRPC(T.RPCChat.localFindGeneralConvFromTeamIDRpcPromise)
  const requestIDRef = React.useRef(0)
  const conversationIDKey =
    cleanInConvIDKey ??
    (generalConversation && generalConversation.teamID === teamID
      ? generalConversation.conversationIDKey
      : undefined)

  React.useEffect(() => {
    requestIDRef.current += 1
    if (cleanInConvIDKey || !teamID) {
      return
    }
    const requestID = requestIDRef.current
    findGeneralConvIDFromTeamID(
      [{teamID}],
      conv => {
        if (requestIDRef.current !== requestID) {
          return
        }
        const meta = Meta.inboxUIItemToConversationMeta(conv)
        if (!meta) {
          return
        }
        ConvoState.metasReceived([meta])
        setGeneralConversation({conversationIDKey: meta.conversationIDKey, teamID})
      },
      () => {}
    )
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [cleanInConvIDKey, findGeneralConvIDFromTeamID, teamID])
  return conversationIDKey
}

const useBotTeamRole = (
  conversationIDKey: T.Chat.ConversationIDKey | undefined,
  botUsername: string
) => {
  const [loaded, setLoaded] = React.useState<
    | {
        botUsername: string
        conversationIDKey: T.Chat.ConversationIDKey
        teamRole?: T.Teams.TeamRoleType
      }
    | undefined
  >()
  const loadBotTeamRole = C.useRPC(T.RPCChat.localGetTeamRoleInConversationRpcPromise)
  const requestIDRef = React.useRef(0)

  React.useEffect(() => {
    requestIDRef.current += 1
    if (!conversationIDKey) {
      return undefined
    }
    const requestID = requestIDRef.current
    loadBotTeamRole(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), username: botUsername}],
      role => {
        if (requestIDRef.current !== requestID) {
          return
        }
        const teamRole = Teams.teamRoleByEnum[role]
        setLoaded({
          botUsername,
          conversationIDKey,
          teamRole: teamRole === 'none' ? undefined : teamRole,
        })
      },
      error => {
        if (requestIDRef.current !== requestID) {
          return
        }
        logger.info(`useBotTeamRole: failed to refresh bot team role: ${error.message}`)
        setLoaded({botUsername, conversationIDKey})
      }
    )
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [botUsername, conversationIDKey, loadBotTeamRole])

  return loaded && loaded.conversationIDKey === conversationIDKey && loaded.botUsername === botUsername
    ? loaded.teamRole
    : undefined
}

const useBotSettings = (
  conversationIDKey: T.Chat.ConversationIDKey | undefined,
  botUsername: string,
  enabled: boolean
) => {
  const [loaded, setLoaded] = React.useState<
    | {
        botUsername: string
        conversationIDKey: T.Chat.ConversationIDKey
        settings?: T.RPCGen.TeamBotSettings
      }
    | undefined
  >()
  const loadBotSettings = C.useRPC(T.RPCChat.localGetBotMemberSettingsRpcPromise)
  const requestIDRef = React.useRef(0)

  React.useEffect(() => {
    requestIDRef.current += 1
    if (!conversationIDKey || !enabled) {
      return undefined
    }
    const requestID = requestIDRef.current
    loadBotSettings(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), username: botUsername}],
      settings => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoaded({botUsername, conversationIDKey, settings})
      },
      error => {
        if (requestIDRef.current !== requestID) {
          return
        }
        logger.info(`useBotSettings: failed to refresh settings for ${botUsername}: ${error.message}`)
        setLoaded({botUsername, conversationIDKey})
      }
    )
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [botUsername, conversationIDKey, enabled, loadBotSettings])

  return enabled && loaded && loaded.conversationIDKey === conversationIDKey && loaded.botUsername === botUsername
    ? loaded.settings
    : undefined
}

type LoaderProps = {
  botUsername: string
  conversationIDKey?: T.Chat.ConversationIDKey
  teamID?: T.Teams.TeamID
}

const InstallBotPopupLoader = (props: LoaderProps) => {
  const botUsername = props.botUsername
  const inConvIDKey = props.conversationIDKey
  const teamID = props.teamID
  const conversationIDKey = useBotConversationIDKey(inConvIDKey, teamID)
  if (!conversationIDKey) return null
  return (
    <ConvoState.ChatProvider id={conversationIDKey}>
      <InstallBotPopup botUsername={botUsername} conversationIDKey={conversationIDKey} />
    </ConvoState.ChatProvider>
  )
}

type Props = {
  botUsername: string
  conversationIDKey?: T.Chat.ConversationIDKey
}

const blankCommands: Array<T.RPCChat.ConversationCommand> = []

const InstallBotPopup = (props: Props) => {
  const {botUsername, conversationIDKey} = props

  // state
  const [installScreen, setInstallScreen] = React.useState(false)
  const [channelPickerScreen, setChannelPickerScreen] = React.useState(false)
  const [installWithCommands, setInstallWithCommands] = React.useState(true)
  const [installWithMentions, setInstallWithMentions] = React.useState(true)
  const [installWithRestrict, setInstallWithRestrict] = React.useState(true)
  const [installInConvs, setInstallInConvs] = React.useState<ReadonlyArray<string>>([])
  const [disableDone, setDisableDone] = React.useState(false)
  const [loadedBotPublicCommands, setLoadedBotPublicCommands] = React.useState<
    | {
        botUsername: string
        commands: T.Chat.BotPublicCommands
      }
    | undefined
  >()

  const meta = ConvoState.useChatContext(s => s.meta)
  const commandsFromMeta = (
    meta.botCommands.typ === T.RPCChat.ConversationCommandGroupsTyp.custom
      ? meta.botCommands.custom.commands || blankCommands
      : blankCommands
  )
    .filter(c => c.username === botUsername)
    .map(c => c.name)
  const commands =
    commandsFromMeta.length > 0
      ? ({commands: commandsFromMeta, loadError: false} satisfies T.Chat.BotPublicCommands)
      : loadedBotPublicCommands?.botUsername === botUsername
        ? loadedBotPublicCommands.commands
        : undefined

  const featured = useFeaturedBot(botUsername)
  const teamRole = useBotTeamRole(conversationIDKey, botUsername)
  const inTeam = teamRole !== undefined ? !!teamRole : undefined
  const inTeamUnrestricted = inTeam && teamRole === 'bot'
  const isBot = teamRole === 'bot' || teamRole === 'restrictedbot' ? true : undefined

  const {yourOperations} = useChatTeam(meta.teamID, meta.teamname)
  const readOnly = meta.teamname ? !yourOperations.manageBots : false
  const settings = useBotSettings(conversationIDKey, botUsername, !!inTeam)
  let teamname: string | undefined
  let teamID: T.Teams.TeamID = T.Teams.noTeamID
  let refreshTeamID: T.Teams.TeamID | undefined
  if (meta.teamname) {
    teamID = meta.teamID
    refreshTeamID = meta.teamID
    teamname = meta.teamname
  }

  const {channelMetas} = useAllChannelMetas(teamID)
  const mutationWaiting = C.Waiting.useAnyWaiting([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
  const error = C.Waiting.useAnyErrors([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
  const mutationError = C.Waiting.useAnyErrors(C.waitingKeyChatBotAdd)
  // dispatch
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  const addBotMember = ConvoState.useChatContext(s => s.dispatch.addBotMember)
  const [pendingMutation, setPendingMutation] = React.useState<'add' | 'edit' | undefined>()
  const onLearn = () => {
    openURL('https://book.keybase.io/docs/chat/restricted-bots')
  }
  const onInstall = () => {
    if (!conversationIDKey) {
      return
    }
    dispatchClearWaiting([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
    setPendingMutation('add')
    addBotMember(botUsername, installWithCommands, installWithMentions, installWithRestrict, installInConvs)
  }
  const editBotSettings = ConvoState.useChatContext(s => s.dispatch.editBotSettings)
  const onEdit = () => {
    if (!conversationIDKey) {
      return
    }
    dispatchClearWaiting([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
    setPendingMutation('edit')
    editBotSettings(botUsername, installWithCommands, installWithMentions, installInConvs)
  }
  const navigateAppend = C.Router2.navigateAppend
  const onRemove = () => {
    if (!conversationIDKey) {
      return
    }
    navigateAppend({
      name: 'chatConfirmRemoveBot',
      params: {botUsername, conversationIDKey, teamID: refreshTeamID},
    })
  }
  const onFeedback = () => {
    navigateAppend({name: 'feedback', params: {}})
  }

  useRefreshBotMembershipOnSuccess(
    conversationIDKey,
    C.waitingKeyChatBotAdd,
    mutationError,
    pendingMutation === 'add',
    () => {
      setPendingMutation(undefined)
      clearModals()
    }
  )

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const loadBotPublicCommands = C.useRPC(T.RPCChat.localListPublicBotCommandsLocalRpcPromise)
  const botPublicCommandsRequestIDRef = React.useRef(0)
  const clearedWaitingForBotRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (!mutationWaiting && clearedWaitingForBotRef.current !== botUsername) {
      clearedWaitingForBotRef.current = botUsername
      dispatchClearWaiting([C.waitingKeyChatBotAdd, C.waitingKeyChatBotRemove])
    }
  }, [botUsername, dispatchClearWaiting, mutationWaiting])
  React.useEffect(() => {
    botPublicCommandsRequestIDRef.current += 1
    if (commandsFromMeta.length > 0) {
      return
    }
    const requestID = botPublicCommandsRequestIDRef.current
    loadBotPublicCommands(
      [{username: botUsername}],
      res => {
        if (botPublicCommandsRequestIDRef.current !== requestID) {
          return
        }
        const commands = (res.commands ?? []).map(command => command.name)
        setLoadedBotPublicCommands({botUsername, commands: {commands, loadError: false}})
      },
      () => {
        if (botPublicCommandsRequestIDRef.current !== requestID) {
          return
        }
        setLoadedBotPublicCommands({botUsername, commands: {commands: [], loadError: true}})
      }
    )
    return () => {
      if (botPublicCommandsRequestIDRef.current === requestID) {
        botPublicCommandsRequestIDRef.current += 1
      }
    }
  }, [botUsername, commandsFromMeta.length, loadBotPublicCommands])

  const restrictedButton = (
    <Kb.Box2 key={RestrictedItem} direction="vertical" fullWidth={true} style={styles.dropdownButton}>
      <Kb.Text type="BodySemibold">Restricted bot (recommended)</Kb.Text>
      <Kb.Text type="BodySmall">Customize which messages get encrypted for this bot.</Kb.Text>
    </Kb.Box2>
  )
  const unrestrictedButton = (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.dropdownButton}>
      <Kb.Text type="BodySemibold">Unrestricted bot</Kb.Text>
      <Kb.Text type="BodySmall">All messages will be encrypted for this bot.</Kb.Text>
    </Kb.Box2>
  )
  const dropdownButtons = [restrictedButton, unrestrictedButton]
  const restrictPicker = !inTeam && !readOnly && (
    <Kb.Dropdown
      items={dropdownButtons}
      selected={installWithRestrict ? restrictedButton : unrestrictedButton}
      onChangedIdx={selected => setInstallWithRestrict(selected === 0)}
      style={styles.dropdown}
      overlayStyle={{width: '100%'}}
    />
  )
  const featuredContent = !!featured && (
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="small">
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
        <Kb.NameWithIcon
          botAlias={featured.botAlias}
          horizontal={true}
          metaOne={featured.description}
          username={botUsername}
          size="big"
        />
        <Kb.Markdown smallStandaloneEmoji={true} selectable={true}>
          {featured.extendedDescription}
        </Kb.Markdown>
      </Kb.Box2>
      {inTeam && isBot && !inTeamUnrestricted && (
        <PermsList
          channelMetas={channelMetas}
          commands={commands}
          settings={settings}
          username={botUsername}
        />
      )}
      {!inTeam && (
        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmallPrimaryLink" onClick={onLearn}>
            Learn more
          </Kb.Text>{' '}
          about bots in Keybase.
        </Kb.Text>
      )}
    </Kb.Box2>
  )
  const usernameContent = !featured && (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      <Kb.NameWithIcon horizontal={true} username={botUsername} size="big" />
      {inTeam && isBot && !inTeamUnrestricted && (
        <PermsList
          channelMetas={channelMetas}
          settings={settings}
          commands={commands}
          username={botUsername}
        />
      )}
    </Kb.Box2>
  )
  const installContent = installScreen && (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.NameWithIcon
        botAlias={featured?.botAlias}
        horizontal={true}
        metaOne={featured?.description}
        username={botUsername}
        size="big"
      />
      {installWithRestrict ? (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
          <Kb.Text type="BodyBig">It will be able to read:</Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
            <Kb.Checkbox
              checked={installWithCommands}
              labelComponent={<CommandsLabel commands={commands} />}
              onCheck={() => setInstallWithCommands(!installWithCommands)}
            />
            <Kb.Checkbox
              checked={installWithMentions}
              labelComponent={
                <Kb.Text
                  style={{flex: 1}}
                  type="Body"
                >{`messages it has been mentioned in with @${botUsername}`}</Kb.Text>
              }
              onCheck={() => setInstallWithMentions(!installWithMentions)}
            />
          </Kb.Box2>
          {teamID && teamname && (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Text type="BodyBig">In these channels:</Kb.Text>
              <Kb.DropdownButton
                selected={
                  <Kb.Box2 direction="horizontal" alignItems="center">
                    <Kb.Avatar
                      size={16}
                      teamname={teamname}
                      style={{marginRight: Kb.Styles.globalMargins.tiny}}
                    />
                    <Kb.Text type="BodySemibold">
                      {teamname}{' '}
                      {installInConvs.length === 1
                        ? `(#${channelMetas.get(installInConvs[0] ?? '')?.channelname ?? ''})`
                        : `(${installInConvs.length > 0 ? installInConvs.length : 'all'} channels)`}
                    </Kb.Text>
                  </Kb.Box2>
                }
                toggleOpen={() => setChannelPickerScreen(true)}
              />
            </Kb.Box2>
          )}
          <Kb.Text type="BodySmall">
            This bot will not be able to read any other messages, channels, files, or repositories.
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.Text type="Body">
            <Kb.Text type="BodySemibold">Warning:</Kb.Text> This bot will be able to read all messages,
            channels, files, and repositories.
          </Kb.Text>
          <Kb.Text type="Body">
            <Kb.Text type="BodyPrimaryLink" onClick={() => setInstallWithRestrict(true)}>
              Install as a restricted bot
            </Kb.Text>
            {' if you’d like to customize which messages are encrypted for this bot.'}
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const channelPickerContent = channelPickerScreen && teamID && teamname && (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <ChannelPicker
        channelMetas={channelMetas}
        installInConvs={installInConvs}
        setChannelPickerScreen={setChannelPickerScreen}
        setDisableDone={setDisableDone}
        setInstallInConvs={setInstallInConvs}
        teamID={teamID}
        teamName={teamname}
      />
    </Kb.Box2>
  )

  const content = channelPickerScreen
    ? channelPickerContent
    : installScreen
      ? installContent
      : featured
        ? featuredContent
        : usernameContent
  const showInstallButton = installScreen && !inTeam && !channelPickerScreen
  const showReviewButton = !installScreen && !inTeam
  const showRemoveButton = inTeam && isBot && !installScreen
  const showEditButton = inTeam && isBot && !inTeamUnrestricted && !installScreen
  const showSaveButton = inTeam && installScreen && !channelPickerContent
  const showDoneButton = channelPickerContent
  const installButton = showInstallButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Install"
      onClick={onInstall}
      mode="Primary"
      type="Default"
      waitingKey={C.waitingKeyChatBotAdd}
    />
  )
  const reviewButton = showReviewButton && (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.reviewButton}>
      {readOnly ? (
        <Kb.Text style={{alignSelf: 'center'}} type="BodySmall">
          Ask an admin or owner to install this bot
        </Kb.Text>
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="BodySmall" style={{alignSelf: 'center'}}>
            Install as
          </Kb.Text>
          {restrictPicker}
        </Kb.Box2>
      )}
      <Kb.WaitingButton
        fullWidth={true}
        label="Review"
        onClick={() => setInstallScreen(true)}
        mode="Primary"
        type="Default"
        waitingKey={C.waitingKeyChatBotAdd}
        disabled={readOnly}
      />
    </Kb.Box2>
  )
  const removeButton = showRemoveButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Uninstall"
      onClick={onRemove}
      mode="Secondary"
      type="Danger"
      waitingKey={C.waitingKeyChatBotRemove}
    />
  )
  const editButton = showEditButton && (
    <Kb.Button
      fullWidth={true}
      label="Edit settings"
      onClick={() => {
        if (settings) {
          setInstallWithCommands(settings.cmds)
          setInstallWithMentions(settings.mentions)
          setInstallInConvs(settings.convs ?? [])
        }
        setInstallScreen(true)
      }}
      mode="Secondary"
      type="Default"
    />
  )
  const saveButton = showSaveButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Save"
      onClick={onEdit}
      mode="Primary"
      type="Default"
      waitingKey={C.waitingKeyChatBotAdd}
    />
  )
  const doneButton = showDoneButton && (
    <Kb.Button
      fullWidth={true}
      label={disableDone ? 'Select at least one channel' : 'Done'}
      onClick={() => setChannelPickerScreen(false)}
      disabled={disableDone}
      mode="Primary"
      type="Default"
    />
  )
  React.useEffect(() => {
    const handleBack = () => {
      if (channelPickerScreen) {
        setChannelPickerScreen(false)
      } else if (installScreen) {
        setInstallScreen(false)
      } else {
        if (Kb.Styles.isMobile) {
          navigateUp()
        } else {
          clearModals()
        }
      }
    }
    useModalHeaderState.setState({
      botInTeam: !!inTeam,
      botReadOnly: readOnly,
      botSubScreen: channelPickerScreen ? 'channels' : installScreen ? 'install' : '',
      onAction: handleBack,
      title: channelPickerScreen ? 'Channels' : '',
    })
    return () => {
      useModalHeaderState.setState({
        botInTeam: false,
        botReadOnly: false,
        botSubScreen: '',
        onAction: undefined,
        title: '',
      })
    }
  }, [channelPickerScreen, installScreen, inTeam, readOnly, navigateUp, clearModals])

  const enabled = !!conversationIDKey
  const bodyContent =
    enabled && !channelPickerScreen ? (
      <Kb.ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent}>
        {content}
      </Kb.ScrollView>
    ) : enabled ? (
      content
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true}>
        <Kb.ProgressIndicator type="Large" />
      </Kb.Box2>
    )
  return (
    <>
      <Kb.Box2 direction="vertical" style={styles.outerContainer} fullWidth={true}>
        {bodyContent}
      </Kb.Box2>
      {enabled && (!readOnly || showReviewButton) ? (
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} centerChildren={true}>
            <Kb.ButtonBar direction="column">
              {doneButton}
              {editButton}
              {saveButton}
              {reviewButton}
              {installButton}
              {removeButton}
            </Kb.ButtonBar>
            {!!error && (
              <Kb.Text type="Body" style={{color: Kb.Styles.globalColors.redDark}}>
                {'Something went wrong! Please try again, or send '}
                <Kb.Text
                  type="Body"
                  style={{color: Kb.Styles.globalColors.redDark}}
                  underline={true}
                  onClick={onFeedback}
                >
                  {'feedback'}
                </Kb.Text>
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
      ) : null}
    </>
  )
}

type CommandsLabelProps = {
  commands: T.Chat.BotPublicCommands | undefined
}

const maxCommandsShown = 3

const CommandsLabel = (props: CommandsLabelProps) => {
  const [expanded, setExpanded] = React.useState(false)
  let inner: React.ReactNode | undefined
  if (!props.commands) {
    inner = <Kb.ProgressIndicator />
  } else if (props.commands.loadError) {
    inner = (
      <Kb.Text type="BodySemibold" style={{color: Kb.Styles.globalColors.redDark}}>
        Error loading bot public commands.
      </Kb.Text>
    )
  } else {
    const numCommands = props.commands.commands.length
    inner = props.commands.commands.map((c: string, i: number) => {
      if (!expanded && i >= maxCommandsShown) {
        return i === maxCommandsShown ? (
          <Kb.Text key={i} type="Body">
            {'• and '}
            <Kb.Text
              type="BodyPrimaryLink"
              onClick={(e: React.BaseSyntheticEvent) => {
                e.stopPropagation()
                setExpanded(true)
              }}
            >{`${numCommands - maxCommandsShown} more`}</Kb.Text>
          </Kb.Text>
        ) : null
      }
      return (
        <Kb.Text key={i} type="Body">
          {`• !${c}`}
        </Kb.Text>
      )
    })
  }
  const punct = (props.commands?.commands.length ?? 0) > 0 ? ':' : '.'
  return (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
      <Kb.Text type="Body">{`messages that begin with bot commands${punct}`}</Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {inner}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type PermsListProps = {
  channelMetas?: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  commands: T.Chat.BotPublicCommands | undefined
  settings?: T.RPCGen.TeamBotSettings
  username: string
}

const PermsList = (props: PermsListProps) => {
  return (
    <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
      <Kb.Text type="BodySemibold">This bot can currently read:</Kb.Text>
      {props.settings ? (
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
          <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
            {!(props.settings.cmds || props.settings.mentions) && (
              <Kb.Text type="Body">{'• no messages, the bot is in write only mode'}</Kb.Text>
            )}
            {props.settings.cmds && (
              <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
                <Kb.Text type="Body">{'•'}</Kb.Text>
                <CommandsLabel commands={props.commands} />
              </Kb.Box2>
            )}
            {props.settings.mentions && (
              <Kb.Text type="Body">{`• messages it has been mentioned in with @${props.username}`}</Kb.Text>
            )}
          </Kb.Box2>
          {props.settings.convs && props.channelMetas && (
            <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
              <Kb.Text type="BodySemibold">In these channels:</Kb.Text>
              {props.settings.convs.map(convID => (
                <Kb.Text type="Body" key={convID}>{`• #${
                  props.channelMetas?.get(convID)?.channelname ?? ''
                }`}</Kb.Text>
              ))}
            </Kb.Box2>
          )}
        </Kb.Box2>
      ) : (
        <Kb.ProgressIndicator type="Large" />
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  bodyScroll: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  bodyScrollContent: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      flexGrow: 1,
      width: '100%',
    },
  }),
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.small),
  },
  dropdown: {
    width: '100%',
  },
  dropdownButton: {
    padding: Kb.Styles.globalMargins.tiny,
  },
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  outerContainer: Kb.Styles.platformStyles({
    common: {
      flex: 1,
      minHeight: 0,
    },
  }),
  reviewButton: {marginTop: -Kb.Styles.globalMargins.tiny},
}))

export default InstallBotPopupLoader
