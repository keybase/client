import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import {ModalTitle} from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'

const Skip = () => {
  const finishNewTeamWizard = Teams.useTeamsState(s => s.dispatch.finishNewTeamWizard)
  const onSkip = () => finishNewTeamWizard()
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsCreation)

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
  const nav = useSafeNavigation()
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  const cancelAddMembersWizard = Teams.useTeamsState(s => s.dispatch.cancelAddMembersWizard)
  const newTeam: boolean = teamID === T.Teams.newTeamWizardTeamID
  // Clicking "skip" concludes the new team wizard. It can error so we should display that here.
  const createTeamError = Teams.useTeamsState(s => (newTeam ? s.newTeamWizard.error : undefined))
  const appendNewTeamBuilder = C.useRouterState(s => s.appendNewTeamBuilder)
  const onContinueKeybase = () => appendNewTeamBuilder(teamID)
  const onContinuePhone = () => nav.safeNavigateAppend('teamAddToTeamPhone')
  const onContinueContacts = () => nav.safeNavigateAppend('teamAddToTeamContacts')
  const onContinueEmail = () => nav.safeNavigateAppend('teamAddToTeamEmail')

  const navForHeader = C.useNav()
  React.useEffect(() => {
    navForHeader.setOptions({
      headerLeft: newTeam
        ? () => <Kb.Icon type="iconfont-arrow-left" onClick={() => nav.safeNavigateUp()} />
        : () => (
            <Kb.Text type="BodyBigLink" onClick={() => cancelAddMembersWizard()}>
              Cancel
            </Kb.Text>
          ),
      headerRight: newTeam ? () => <Skip /> : undefined,
      headerTitle: () => (
        <ModalTitle
          title={Kb.Styles.isMobile ? 'Add/Invite people' : 'Add or invite people'}
          teamID={teamID}
        />
      ),
    })
  }, [navForHeader, newTeam, nav, cancelAddMembersWizard, teamID])

  return (
    <>
      {createTeamError ? (
        <Kb.Banner color="red" key="err">
          {createTeamError}
        </Kb.Banner>
      ) : null}
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
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
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
