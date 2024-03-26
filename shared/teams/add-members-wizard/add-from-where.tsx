import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import * as T from '@/constants/types'
import {ModalTitle} from '../common'

const Skip = () => {
  const finishNewTeamWizard = C.useTeamsState(s => s.dispatch.finishNewTeamWizard)
  const onSkip = () => finishNewTeamWizard()
  const waiting = C.Waiting.useAnyWaiting(C.Teams.teamCreationWaitingKey)

  if (Kb.Styles.isMobile) {
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
  const nav = Container.useSafeNavigation()
  const teamID = C.useTeamsState(s => s.addMembersWizard.teamID)
  const cancelAddMembersWizard = C.useTeamsState(s => s.dispatch.cancelAddMembersWizard)
  const newTeam: boolean = teamID === T.Teams.newTeamWizardTeamID
  // Clicking "skip" concludes the new team wizard. It can error so we should display that here.
  const createTeamError = C.useTeamsState(s => (newTeam ? s.newTeamWizard.error : undefined))
  const onClose = () => cancelAddMembersWizard()
  const onBack = () => nav.safeNavigateUp()
  const appendNewTeamBuilder = C.useRouterState(s => s.appendNewTeamBuilder)
  const onContinueKeybase = () => appendNewTeamBuilder(teamID)
  const onContinuePhone = () => nav.safeNavigateAppend('teamAddToTeamPhone')
  const onContinueContacts = () => nav.safeNavigateAppend('teamAddToTeamContacts')
  const onContinueEmail = () => nav.safeNavigateAppend('teamAddToTeamEmail')
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
        ) : Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ) : undefined,
        rightButton: newTeam ? <Skip /> : undefined,
        title: (
          <ModalTitle
            title={Kb.Styles.isMobile ? 'Add/Invite people' : 'Add or invite people'}
            teamID={teamID}
          />
        ),
      }}
      mode="DefaultFullHeight"
      backgroundStyle={styles.bg}
    >
      <Kb.Box2
        direction="vertical"
        gap={Kb.Styles.isMobile ? 'tiny' : 'xsmall'}
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
        {Kb.Styles.isMobile && (
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
    isElectron: {borderRadius: 4},
  }),
  body: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
    isElectron: {
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.xlarge
      ),
      borderBottomRadius: 4,
    },
    isMobile: {
      ...Kb.Styles.globalStyles.flexOne,
      ...Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.small),
    },
  }),
}))

export default AddFromWhere
