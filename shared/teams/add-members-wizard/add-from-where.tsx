import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {appendNewTeamBuilder} from '../../actions/typed-routes'
import {ModalTitle} from '../common'

const Skip = () => {
  const dispatch = Container.useDispatch()
  const onSkip = () => dispatch(TeamsGen.createFinishNewTeamWizard())
  const waiting = Container.useAnyWaiting(Constants.teamCreationWaitingKey)

  if (Styles.isMobile) {
    return waiting ? (
      <Kb.ProgressIndicator />
    ) : (
      <Kb.Text type="BodyBigLink" onClick={onSkip}>
        Skip
      </Kb.Text>
    )
  } else {
    return <Kb.Button mode="Secondary" label="Skip" small={true} onClick={onSkip} waiting={waiting} />
  }
}

const AddFromWhere = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)
  const newTeam: boolean = teamID === Types.newTeamWizardTeamID
  // Clicking "skip" concludes the new team wizard. It can error so we should display that here.
  const createTeamError = Container.useSelector(s => (newTeam ? s.teams.newTeamWizard.error : undefined))

  const onClose = () => dispatch(TeamsGen.createCancelAddMembersWizard())
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onContinueKeybase = () => dispatch(appendNewTeamBuilder(teamID))
  const onContinuePhone = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamPhone']}))
  const onContinueContacts = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamContacts']}))
  const onContinueEmail = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamEmail']}))
  return (
    <Kb.Modal
      allowOverflow={true}
      onClose={newTeam ? undefined : onClose} // Only show the close button if we're not coming from the new team wizard
      banners={
        createTeamError ? (
          <Kb.Banner color="red" key="err">
            {createTeamError}
          </Kb.Banner>
        ) : null
      }
      header={{
        leftButton: newTeam ? (
          <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />
        ) : Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ) : undefined,
        rightButton: newTeam ? <Skip /> : undefined,
        title: (
          <ModalTitle
            title={Styles.isMobile ? 'Add/Invite people' : 'Add or invite people'}
            teamID={teamID}
          />
        ),
      }}
      mode="DefaultFullHeight"
      backgroundStyle={styles.bg}
    >
      <Kb.Box2
        direction="vertical"
        gap={Styles.isMobile ? 'tiny' : 'xsmall'}
        style={styles.body}
        fullWidth={true}
      >
        <Kb.Text type="Body">
          {newTeam ? 'Where will your first team members come from?' : 'How would you like to add people?'}
        </Kb.Text>
        <Kb.RichButton
          icon="icon-teams-add-search-64"
          title="From Keybase"
          description="Search users by username."
          onClick={onContinueKeybase}
        />
        <Kb.RichButton
          icon="icon-teams-add-email-list-64"
          title="A list of email addresses"
          description="Enter one or multiple email addresses."
          onClick={onContinueEmail}
        />
        {Styles.isMobile && (
          <Kb.RichButton
            icon="icon-teams-add-phone-contacts-64"
            title="From your contacts"
            description="Add your friends, family, or colleagues."
            onClick={onContinueContacts}
          />
        )}
        <Kb.RichButton
          icon="icon-teams-add-number-list-64"
          title="A list of phone numbers"
          description="Enter one or multiple phone numbers"
          onClick={onContinuePhone}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  bg: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blueGrey},
    isElectron: {borderRadius: 4},
  }),
  body: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blueGrey},
    isElectron: {
      ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, Styles.globalMargins.xlarge),
      borderBottomRadius: 4,
    },
    isMobile: {
      ...Styles.globalStyles.flexOne,
      ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
    },
  }),
}))

export default AddFromWhere
