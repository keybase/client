import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TeamTypes from '../../../constants/teams'
import * as Types from '../../../constants/types/chat2'

type Origin = {
  name: string
  isTeam: boolean
}

type Props = Container.RouteProps<{botUsername: string; origin?: Origin}>

const InstallBotPopup = (props: Props) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const origin = Container.getRouteProps(props, 'origin', undefined)

  // state
  const [installScreen, setInstallScreen] = React.useState(false)
  const [installWithCommands, setInstallWithCommands] = React.useState(true)
  const [installWithMentions, setInstallWithMentions] = React.useState(true)
  const {commands, featured, inOrigin} = Container.useSelector(state => ({
    commands: state.chat2.botPublicCommands.get(botUsername),
    featured: state.chat2.featuredBotsMap.get(botUsername),
    inOrigin: origin && (!origin.isTeam || TeamTypes.userInTeam(state, origin.name, botUsername)),
  }))
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  // lifecycle
  React.useEffect(() => {
    dispatch(Chat2Gen.createRefreshBotPublicCommands({username: botUsername}))
  }, [])
  // merge
  const showInstallButton = !origin || !inOrigin

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
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Text type="Body">{featured.description}</Kb.Text>
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
    </Kb.Box2>
  )
  const installContent = installScreen && (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodyBigExtrabold">{featured ? featured.botAlias : botUsername}</Kb.Text>
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
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {!showInstallButton ? 'Close' : 'Cancel'}
          </Kb.Text>
        ),
        title: '',
      }}
      footer={
        showInstallButton
          ? {
              content: (
                <Kb.Button
                  fullWidth={true}
                  label="Install (free)"
                  onClick={() => setInstallScreen(true)}
                  mode="Primary"
                  type="Default"
                />
              ),
            }
          : undefined
      }
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

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
  },
}))

export default InstallBotPopup
