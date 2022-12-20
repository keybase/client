import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
type Props = {conversationID: string}

const BlockButtons = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamname = Container.useSelector(state => state.chat2.metaMap.get(props.conversationID)?.teamname)
  const teamID = Container.useSelector(state => state.chat2.metaMap.get(props.conversationID)?.teamID ?? '')
  const blockButtonInfo = Container.useSelector(state => {
    const blockButtonsMap = state.chat2.blockButtonsMap
    return teamID ? blockButtonsMap.get(teamID) : undefined
  })
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, props.conversationID)
  )
  const currentUser = Container.useSelector(state => state.config.username)
  if (!blockButtonInfo) {
    return null
  }
  const team = teamname
  const adder = blockButtonInfo.adder
  const others = (team ? participantInfo.all : participantInfo.name).filter(
    person => person !== currentUser && person !== adder && !Constants.isAssertion(person)
  )

  const onViewProfile = () => dispatch(ProfileGen.createShowUserProfile({username: adder}))
  const onViewTeam = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))
  const onBlock = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {
              blockUserByDefault: true,
              convID: props.conversationID,
              others: others,
              team: team,
              username: adder,
            },
            selected: 'chatBlockingModal',
          },
        ],
      })
    )
  const onDismiss = () => dispatch(Chat2Gen.createDismissBlockButtons({teamID}))

  const buttonRow = (
    <Kb.ButtonBar
      fullWidth={Styles.isMobile}
      direction={Styles.isMobile ? 'column' : 'row'}
      style={styles.button}
    >
      <Kb.WaveButton
        small={true}
        conversationIDKey={props.conversationID}
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
    } as const)
)
