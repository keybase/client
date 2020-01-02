/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as WaitingGen from '../../../actions/waiting-gen'
import * as Teams from '../../../constants/teams'
import * as Types from '../../../constants/types/chat2'
import * as TeamTypes from '../../../constants/types/teams'
import * as Constants from '../../../constants/chat2'
import * as RPCTypes from '../../../constants/types/rpc-gen'

export const useBotConversationIDKey = (inConvIDKey?: Types.ConversationIDKey, teamID?: TeamTypes.TeamID) => {
  const [conversationIDKey, setConversationIDKey] = React.useState(inConvIDKey)
  const generalConvID = Container.useSelector(
    (state: Container.TypedState) => teamID && state.chat2.teamIDToGeneralConvID.get(teamID)
  )
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (!conversationIDKey && teamID) {
      if (!generalConvID) {
        dispatch(Chat2Gen.createFindGeneralConvIDFromTeamID({teamID}))
      } else {
        setConversationIDKey(generalConvID)
      }
    }
  }, [conversationIDKey, dispatch, generalConvID, teamID])
  return conversationIDKey
}

type LoaderProps = Container.RouteProps<{
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
  teamID?: TeamTypes.TeamID
}>

const InstallBotPopupLoader = (props: LoaderProps) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const inConvIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)
  const teamID = Container.getRouteProps(props, 'teamID', undefined)
  const conversationIDKey = useBotConversationIDKey(inConvIDKey, teamID)
  return <InstallBotPopup botUsername={botUsername} conversationIDKey={conversationIDKey} />
}

type Props = {
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
}

const InstallBotPopup = (props: Props) => {
  const {botUsername, conversationIDKey} = props

  // state
  const [installScreen, setInstallScreen] = React.useState(false)
  const [installWithCommands, setInstallWithCommands] = React.useState(true)
  const [installWithMentions, setInstallWithMentions] = React.useState(true)
  const [installWithRestrict, setInstallWithRestrict] = React.useState(true)
  const {commands, featured, inTeam, inTeamUnrestricted, settings} = Container.useSelector(
    (state: Container.TypedState) => {
      let inTeam: boolean | undefined
      let teamRole: TeamTypes.TeamRoleType | undefined
      if (conversationIDKey) {
        teamRole = state.chat2.botTeamRoleInConvMap.get(conversationIDKey)?.get(botUsername) ?? undefined
        inTeam = !!teamRole
      }
      return {
        commands: state.chat2.botPublicCommands.get(botUsername),
        featured: state.chat2.featuredBotsMap.get(botUsername),
        inTeam,
        inTeamUnrestricted: teamRole === 'bot',
        settings: conversationIDKey
          ? state.chat2.botSettings.get(conversationIDKey)?.get(botUsername) ?? undefined
          : undefined,
      }
    }
  )
  const error = Container.useAnyErrors(Constants.waitingKeyBotAdd, Constants.waitingKeyBotRemove)
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    if (installScreen) {
      setInstallScreen(false)
    } else {
      dispatch(RouteTreeGen.createClearModals())
    }
  }
  const onInstall = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(
      Chat2Gen.createAddBotMember({
        allowCommands: installWithCommands,
        allowMentions: installWithMentions,
        conversationIDKey,
        restricted: installWithRestrict,
        username: botUsername,
      })
    )
  }
  const onEdit = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(
      Chat2Gen.createEditBotSettings({
        allowCommands: installWithCommands,
        allowMentions: installWithMentions,
        conversationIDKey,
        username: botUsername,
      })
    )
  }
  const onRemove = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              botUsername,
              conversationIDKey,
              namespace: 'chat2',
            },
            selected: 'chatConfirmRemoveBot',
          },
        ],
      })
    )
  }
  const onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
  }
  // lifecycle
  React.useEffect(() => {
    dispatch(
      WaitingGen.createClearWaiting({key: [Constants.waitingKeyBotAdd, Constants.waitingKeyBotRemove]})
    )
    dispatch(Chat2Gen.createRefreshBotPublicCommands({username: botUsername}))
    if (conversationIDKey) {
      dispatch(Chat2Gen.createRefreshBotRoleInConv({conversationIDKey, username: botUsername}))
      if (inTeam) {
        dispatch(Chat2Gen.createRefreshBotSettings({conversationIDKey, username: botUsername}))
      }
    }
  }, [conversationIDKey, inTeam])

  const restrictPicker = !inTeam && (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
      <Kb.Text type="BodyBigExtrabold">Install as:</Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
        <Kb.RadioButton
          label={
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySemibold">Restricted Bot</Kb.Text>
              <Kb.Text type="BodySmall">Customize which messages get encrypted for this bot.</Kb.Text>
            </Kb.Box2>
          }
          onSelect={() => setInstallWithRestrict(true)}
          selected={installWithRestrict}
        />
        <Kb.RadioButton
          label={
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySemibold">Unrestricted Bot</Kb.Text>
              <Kb.Text type="BodySmall">All messages will be encrypted for this bot.</Kb.Text>
            </Kb.Box2>
          }
          onSelect={() => setInstallWithRestrict(false)}
          selected={!installWithRestrict}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
  const featuredContent = !!featured && (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical" style={{flex: 1}}>
          <Kb.Text type="BodyBigExtrabold">{featured.botAlias}</Kb.Text>
          <Kb.ConnectedUsernames
            colorFollowing={true}
            type="BodySemibold"
            usernames={[botUsername]}
            withProfileCardPopup={false}
          />
          <Kb.Text type="BodySmall" lineClamp={1}>
            {featured.description}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Text type="BodySmall">{featured.extendedDescription}</Kb.Text>
      {inTeam && !inTeamUnrestricted && <PermsList settings={settings} username={botUsername} />}
      {restrictPicker}
    </Kb.Box2>
  )
  const usernameContent = !featured && (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical">
          <Kb.ConnectedUsernames
            colorFollowing={true}
            type="BodyBigExtrabold"
            usernames={[botUsername]}
            withProfileCardPopup={false}
          />
        </Kb.Box2>
      </Kb.Box2>
      {inTeam && !inTeamUnrestricted && <PermsList settings={settings} username={botUsername} />}
      {restrictPicker}
    </Kb.Box2>
  )
  const installContent = installScreen && (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical" style={{flex: 1}}>
          <Kb.Text type="BodyBigExtrabold">{featured ? featured.botAlias : botUsername}</Kb.Text>
          {!!featured && (
            <Kb.Text type="BodySmall" lineClamp={1}>
              {featured.description}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
      {installWithRestrict ? (
        <>
          <Kb.Text type="BodyBig">It will be able to read:</Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
            <Kb.Checkbox
              checked={installWithCommands}
              labelComponent={<CommandsLabel commands={commands} />}
              onCheck={() => setInstallWithCommands(!installWithCommands)}
            />
            <Kb.Checkbox
              checked={installWithMentions}
              label={`messages it has been mentioned in with @${botUsername}`}
              onCheck={() => setInstallWithMentions(!installWithMentions)}
            />
          </Kb.Box2>
          <Kb.Text type="BodySmall">
            This bot will not be able to read any other messages, channels, files, repositories, or team
            members.
          </Kb.Text>
        </>
      ) : (
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.Text type="BodySemibold" style={{alignSelf: 'center', color: Styles.globalColors.redDark}}>
            WARNING
          </Kb.Text>
          <Kb.Text type="BodySmall">
            This bot will be able to read all messages, channels, files, repositories, and team members.
          </Kb.Text>
          <Kb.Text type="BodySmall">
            If you wish to customize which messages are encrypted for this bot, please go back and select the
            restricted bot option.
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const content = installScreen ? installContent : featured ? featuredContent : usernameContent
  const showInstallButton = installScreen && !inTeam
  const showReviewButton = !installScreen && !inTeam
  const showRemoveButton = inTeam && !installScreen
  const showEditButton = inTeam && !inTeamUnrestricted && !installScreen
  const showSaveButton = inTeam && installScreen
  const installButton = showInstallButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Install"
      onClick={onInstall}
      mode="Primary"
      type="Default"
      waitingKey={Constants.waitingKeyBotAdd}
    />
  )
  const reviewButton = showReviewButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Review"
      onClick={() => setInstallScreen(true)}
      mode="Primary"
      type="Default"
      waitingKey={Constants.waitingKeyBotAdd}
    />
  )
  const removeButton = showRemoveButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Uninstall"
      onClick={onRemove}
      mode="Secondary"
      type="Danger"
      waitingKey={Constants.waitingKeyBotRemove}
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
      waitingKey={Constants.waitingKeyBotAdd}
    />
  )
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {installScreen ? 'Back' : inTeam ? 'Close' : 'Cancel'}
          </Kb.Text>
        ),
        title: '',
      }}
      footer={{
        content:
          !conversationIDKey || inTeam === undefined ? (
            <Kb.ProgressIndicator />
          ) : (
            <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
              <Kb.ButtonBar direction="column">
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
      }}
    >
      {content}
    </Kb.Modal>
  )
}

type CommandsLabelProps = {
  commands: Types.BotPublicCommands | undefined
}

const maxCommandsShown = 3

const CommandsLabel = (props: CommandsLabelProps) => {
  const [expanded, setExpanded] = React.useState(false)
  if (!props.commands) {
    return <Kb.ProgressIndicator />
  } else if (props.commands.loadError) {
    return <Kb.Text type="BodySemibold">Error loading bot public commands.</Kb.Text>
  } else {
    const numCommands = props.commands.commands.length
    return (
      <Kb.Box2 direction="vertical" gap="tiny">
        <Kb.Text type="Body">messages that begin with public commands:</Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {props.commands.commands.map((c: string, i: number) => {
            if (!expanded && i >= maxCommandsShown) {
              return i === maxCommandsShown ? (
                <Kb.Text type="Body">
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
          })}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

type PermsListProps = {
  settings?: RPCTypes.TeamBotSettings
  username: string
}

const PermsList = (props: PermsListProps) => {
  return (
    <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
      <Kb.Text type="BodySemibold">This bot can currently read:</Kb.Text>
      {props.settings ? (
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          {!(props.settings.cmds || props.settings.mentions) && (
            <Kb.Text type="Body">{'• no messages, the bot is in write only mode'}</Kb.Text>
          )}
          {props.settings.cmds && <Kb.Text type="Body">{'• messages that begin with bot commands.'}</Kb.Text>}
          {props.settings.mentions && (
            <Kb.Text type="Body">{`• messages it has been mentioned in with @${props.username}`}</Kb.Text>
          )}
        </Kb.Box2>
      ) : (
        <Kb.ProgressIndicator />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
  },
}))

export default InstallBotPopupLoader
