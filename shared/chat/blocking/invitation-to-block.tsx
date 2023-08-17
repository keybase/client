import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'

const BlockButtons = () => {
  const nav = Container.useSafeNavigation()
  const conversationIDKey = C.useChatContext(s => s.id)

  const teamname = C.useChatContext(s => s.meta.teamname)
  const teamID = C.useChatContext(s => s.meta.teamID)
  const blockButtonInfo = C.useChatState(s => {
    const blockButtonsMap = s.blockButtonsMap
    return teamID ? blockButtonsMap.get(teamID) : undefined
  })
  const participantInfo = C.useChatContext(s => s.participants)
  const currentUser = C.useCurrentUserState(s => s.username)
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const dismissBlockButtons = C.useChatContext(s => s.dispatch.dismissBlockButtons)
  if (!blockButtonInfo) {
    return null
  }
  const team = teamname
  const adder = blockButtonInfo.adder
  const others = (team ? participantInfo.all : participantInfo.name).filter(
    person => person !== currentUser && person !== adder && !Constants.isAssertion(person)
  )

  const onViewProfile = () => showUserProfile(adder)
  const onViewTeam = () => nav.safeNavigateAppend({props: {teamID}, selected: 'team'})
  const onBlock = () =>
    nav.safeNavigateAppend({
      props: {
        blockUserByDefault: true,
        convID: conversationIDKey,
        others: others,
        team: team,
        username: adder,
      },
      selected: 'chatBlockingModal',
    })
  const onDismiss = () => dismissBlockButtons(teamID)

  const buttonRow = (
    <Kb.ButtonBar
      fullWidth={Styles.isMobile}
      direction={Styles.isMobile ? 'column' : 'row'}
      style={styles.button}
    >
      <Kb.WaveButton
        small={true}
        conversationIDKey={conversationIDKey}
        toMany={others.length > 0 || !!team}
        style={styles.waveButton}
      />
      {!team && others.length === 0 ? (
        <Kb.Button
          label="View profile"
          style={styles.button}
          small={true}
          mode="Secondary"
          onClick={onViewProfile}
        />
      ) : null}
      {team ? (
        <Kb.Button
          label="View team"
          style={styles.button}
          mode="Secondary"
          small={true}
          onClick={onViewTeam}
        />
      ) : null}
      <Kb.Button
        label="Block"
        type="Danger"
        mode="Secondary"
        style={styles.button}
        small={true}
        onClick={onBlock}
      />
    </Kb.ButtonBar>
  )
  return Styles.isMobile ? (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      gap="tiny"
      style={styles.dismissContainer}
      fullWidth={true}
    >
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} centerChildren={true}>
        <Kb.Text type="BodySmall">
          {team ? `${adder} added you to this team.` : `You don't follow ${adder}.`}
        </Kb.Text>
        <Kb.Icon style={styles.dismissIcon} type="iconfont-close" onClick={onDismiss} />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.buttonContainer}>
        {buttonRow}
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="horizontal" gap="xsmall" style={styles.container} centerChildren={false}>
      <Kb.Text type="BodySmall">
        {team ? `${adder} added you to this team.` : `You don't follow ${adder}.`}
      </Kb.Text>
      {buttonRow}
      <Kb.Icon type="iconfont-remove" onClick={onDismiss} />
    </Kb.Box2>
  )
}

export default BlockButtons

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: Styles.platformStyles({
        isElectron: {
          width: '',
        },
        isMobile: {
          ...Styles.padding(0, Styles.globalMargins.small),
        },
      }),
      buttonContainer: {maxWidth: 322},
      container: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginLeft: 57,
      },
      dismissContainer: {
        backgroundColor: Styles.globalColors.blueGrey,
        paddingBottom: Styles.globalMargins.xsmall,
        paddingTop: Styles.globalMargins.xsmall,
        position: 'relative',
      },
      dismissIcon: {
        position: 'absolute',
        right: Styles.globalMargins.small,
        top: -1,
      },
      waveButton: Styles.platformStyles({
        isElectron: {
          width: '',
        },
      }),
    }) as const
)
