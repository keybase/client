import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Styles from '@/styles'
import ChannelPicker from './channel-picker'
import openURL from '@/util/open-url'
import * as T from '@/constants/types'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'

const RestrictedItem = '---RESTRICTED---'

export const useBotConversationIDKey = (inConvIDKey?: T.Chat.ConversationIDKey, teamID?: T.Teams.TeamID) => {
  const cleanInConvIDKey = T.Chat.isValidConversationIDKey(inConvIDKey ?? '') ? inConvIDKey : undefined
  const [conversationIDKey, setConversationIDKey] = React.useState(cleanInConvIDKey)
  const generalConvID = C.useChatState(s => teamID && s.teamIDToGeneralConvID.get(teamID))
  const findGeneralConvIDFromTeamID = C.useChatState(s => s.dispatch.findGeneralConvIDFromTeamID)
  React.useEffect(() => {
    if (!cleanInConvIDKey && teamID) {
      if (!generalConvID) {
        findGeneralConvIDFromTeamID(teamID)
      } else {
        setConversationIDKey(generalConvID)
      }
    }
  }, [cleanInConvIDKey, findGeneralConvIDFromTeamID, generalConvID, teamID])
  return conversationIDKey
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
    <C.ChatProvider id={conversationIDKey}>
      <InstallBotPopup botUsername={botUsername} conversationIDKey={conversationIDKey} />
    </C.ChatProvider>
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

  const botPublicCommands = C.useChatState(s => s.botPublicCommands.get(botUsername))
  const meta = C.useChatContext(s => s.meta)
  const commands = React.useMemo(() => {
    const {botCommands} = meta
    const commands = (
      botCommands.typ === T.RPCChat.ConversationCommandGroupsTyp.custom
        ? botCommands.custom.commands || blankCommands
        : blankCommands
    )
      .filter(c => c.username === botUsername)
      .map(c => c.name)
    const convCommands: T.Chat.BotPublicCommands = {commands, loadError: false}
    return commands.length > 0 ? convCommands : botPublicCommands
  }, [meta, botPublicCommands, botUsername])

  const featured = C.useBotsState(s => s.featuredBotsMap.get(botUsername))
  const teamRole = C.useChatContext(s => s.botTeamRoleMap.get(botUsername))
  const inTeam = teamRole !== undefined ? !!teamRole : undefined
  const inTeamUnrestricted = inTeam && teamRole === 'bot'
  const isBot = teamRole === 'bot' || teamRole === 'restrictedbot' ? true : undefined

  const readOnly = C.useTeamsState(s =>
    meta.teamname ? !C.Teams.getCanPerformByID(s, meta.teamID).manageBots : false
  )
  const settings = C.useChatContext(s => s.botSettings.get(botUsername) ?? undefined)
  let teamname: string | undefined
  let teamID: T.Teams.TeamID = T.Teams.noTeamID
  if (meta.teamname) {
    teamID = meta.teamID
    teamname = meta.teamname
  }

  const {channelMetas} = useAllChannelMetas(teamID)
  const error = C.Waiting.useAnyErrors([C.Chat.waitingKeyBotAdd, C.Chat.waitingKeyBotRemove])
  // dispatch
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const addBotMember = C.useChatContext(s => s.dispatch.addBotMember)
  const onClose = () => {
    Styles.isMobile ? navigateUp() : clearModals()
  }
  const onLearn = () => {
    openURL('https://book.keybase.io/docs/chat/restricted-bots')
  }
  const onLeftAction = () => {
    if (installScreen) {
      setInstallScreen(false)
    } else {
      onClose()
    }
  }
  const onInstall = () => {
    if (!conversationIDKey) {
      return
    }
    addBotMember(botUsername, installWithCommands, installWithMentions, installWithRestrict, installInConvs)
  }
  const editBotSettings = C.useChatContext(s => s.dispatch.editBotSettings)
  const onEdit = () => {
    if (!conversationIDKey) {
      return
    }
    editBotSettings(botUsername, installWithCommands, installWithMentions, installInConvs)
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onRemove = () => {
    if (!conversationIDKey) {
      return
    }
    navigateAppend({
      props: {botUsername, conversationIDKey},
      selected: 'chatConfirmRemoveBot',
    })
  }
  const onFeedback = () => {
    navigateAppend('feedback')
  }

  const refreshBotSettings = C.useChatContext(s => s.dispatch.refreshBotSettings)
  const refreshBotRoleInConv = C.useChatContext(s => s.dispatch.refreshBotRoleInConv)

  // lifecycle
  React.useEffect(() => {
    if (conversationIDKey) {
      refreshBotRoleInConv(botUsername)
      if (inTeam) {
        refreshBotSettings(botUsername)
      }
    }
  }, [refreshBotRoleInConv, refreshBotSettings, conversationIDKey, inTeam, botUsername])
  const noCommands = !commands?.commands

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const refreshBotPublicCommands = C.useChatState(s => s.dispatch.refreshBotPublicCommands)
  React.useEffect(() => {
    dispatchClearWaiting([C.Chat.waitingKeyBotAdd, C.Chat.waitingKeyBotRemove])
    if (noCommands) {
      refreshBotPublicCommands(botUsername)
    }
  }, [dispatchClearWaiting, refreshBotPublicCommands, noCommands, botUsername])

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
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([styles.container, {flex: 1}])}
      fullWidth={true}
      gap="small"
    >
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
                      style={{marginRight: Styles.globalMargins.tiny}}
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
            </Kb.Text>{' '}
            if you’d like to customize which messages are encrypted for this bot.
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
  const getHeight = () => {
    if (channelPickerScreen) {
      return 440
    }
    return 560
  }
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
      waitingKey={C.Chat.waitingKeyBotAdd}
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
        waitingKey={C.Chat.waitingKeyBotAdd}
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
      waitingKey={C.Chat.waitingKeyBotRemove}
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
      waitingKey={C.Chat.waitingKeyBotAdd}
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
  const backButton = Styles.isMobile ? 'Back' : <Kb.Icon type="iconfont-arrow-left" />
  const enabled = !!conversationIDKey
  return (
    <Kb.Modal
      onClose={!Styles.isMobile ? onClose : undefined}
      header={{
        leftButton: channelPickerScreen ? (
          <Kb.Text type="BodyBigLink" onClick={() => setChannelPickerScreen(false)}>
            Back
          </Kb.Text>
        ) : Styles.isMobile || installScreen ? (
          <Kb.Text type="BodyBigLink" onClick={onLeftAction}>
            {installScreen ? backButton : inTeam || readOnly ? 'Close' : 'Cancel'}
          </Kb.Text>
        ) : undefined,
        title: channelPickerScreen ? 'Channels' : '',
      }}
      footer={
        enabled && (!readOnly || showReviewButton)
          ? {
              content: (
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
                    <Kb.Text type="Body" style={{color: Styles.globalColors.redDark}}>
                      {'Something went wrong! Please try again, or send '}
                      <Kb.Text
                        type="Body"
                        style={{color: Styles.globalColors.redDark}}
                        underline={true}
                        onClick={onFeedback}
                      >
                        {'feedback'}
                      </Kb.Text>
                    </Kb.Text>
                  )}
                </Kb.Box2>
              ),
            }
          : undefined
      }
    >
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.outerContainer, {height: getHeight()}])}
        fullWidth={true}
      >
        {enabled ? (
          content
        ) : (
          <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true}>
            <Kb.ProgressIndicator type="Large" />
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Modal>
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
      <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.redDark}}>
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

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
  },
  dropdown: {
    width: '100%',
  },
  dropdownButton: {
    padding: Styles.globalMargins.tiny,
  },
  outerContainer: Styles.platformStyles({
    isElectron: {
      height: 560,
    },
  }),
  reviewButton: {marginTop: -Styles.globalMargins.tiny},
}))

export default InstallBotPopupLoader
