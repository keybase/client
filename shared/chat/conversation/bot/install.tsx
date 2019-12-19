import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Teams from '../../../constants/teams'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as RPCTypes from '../../../constants/types/rpc-gen'

type Props = Container.RouteProps<{botUsername: string; conversationIDKey?: Types.ConversationIDKey}>

const InstallBotPopup = (props: Props) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)

  // state
  const [installScreen, setInstallScreen] = React.useState(false)
  const [installWithCommands, setInstallWithCommands] = React.useState(true)
  const [installWithMentions, setInstallWithMentions] = React.useState(true)
  const {commands, featured, inTeam, settings} = Container.useSelector(state => {
    const meta = conversationIDKey && state.chat2.metaMap.get(conversationIDKey)
    let inTeam = false
    if (meta) {
      if (meta.teamType === 'adhoc') {
        inTeam = meta.participants.includes(botUsername)
      } else {
        inTeam = Teams.userInTeam(state, meta.teamname, botUsername)
      }
    }
    return {
      commands: state.chat2.botPublicCommands.get(botUsername),
      featured: state.chat2.featuredBotsMap.get(botUsername),
      inTeam,
      settings: conversationIDKey
        ? state.chat2.botSettings.get(conversationIDKey)?.get(botUsername) ?? undefined
        : undefined,
    }
  })
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
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
        username: botUsername,
      })
    )
  }
  const onRemove = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(Chat2Gen.createRemoveBotMember({conversationIDKey, username: botUsername}))
  }
  // lifecycle
  React.useEffect(() => {
    dispatch(Chat2Gen.createRefreshBotPublicCommands({username: botUsername}))
    if (conversationIDKey && inTeam) {
      dispatch(Chat2Gen.createRefreshBotSettings({conversationIDKey, username: botUsername}))
    }
  }, [])

  const featuredContent = !!featured && (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodyBigExtrabold">{featured.botAlias}</Kb.Text>
          <Kb.ConnectedUsernames
            colorFollowing={true}
            type="BodySemibold"
            usernames={[botUsername]}
            withProfileCardPopup={false}
          />
          <Kb.Text type="BodySmall">{featured.description}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Text type="BodySmall">{featured.extendedDescription}</Kb.Text>
      {inTeam && <PermsList settings={settings} username={botUsername} />}
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
      {inTeam && <PermsList settings={settings} username={botUsername} />}
    </Kb.Box2>
  )
  const installContent = installScreen && (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodyBigExtrabold">{featured ? featured.botAlias : botUsername}</Kb.Text>
          <Kb.Text type="BodySmall">{featured.description}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
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
        This bot will not be able to read any other messages, channels, files, repositories, or team members.
      </Kb.Text>
    </Kb.Box2>
  )
  const content = installScreen ? installContent : featured ? featuredContent : usernameContent
  const buttonText = installScreen ? 'Install (free)' : inTeam ? 'Remove' : 'Install (free)'
  const buttonClick = installScreen ? onInstall : inTeam ? onRemove : () => setInstallScreen(true)
  const buttonWaitingKey = inTeam ? Constants.waitingKeyBotRemove : Constants.waitingKeyBotAdd
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {inTeam ? 'Close' : 'Cancel'}
          </Kb.Text>
        ),
        title: '',
      }}
      footer={{
        content: (
          <Kb.WaitingButton
            fullWidth={true}
            label={buttonText}
            onClick={buttonClick}
            mode="Primary"
            type="Default"
            waitingKey={buttonWaitingKey}
          />
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

const CommandsLabel = (props: CommandsLabelProps) => {
  if (!props.commands) {
    return <Kb.ProgressIndicator />
  } else if (props.commands.loadError) {
    return <Kb.Text type="BodySemibold">Error loading bot public commands.</Kb.Text>
  } else {
    return (
      <Kb.Box2 direction="vertical" gap="tiny">
        <Kb.Text type="Body">messages that begin with public commands:</Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {props.commands.commands.map((c: string, i: number) => {
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

export default InstallBotPopup
