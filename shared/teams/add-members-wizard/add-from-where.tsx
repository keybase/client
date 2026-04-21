import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {
  route: {params?: {teamID?: T.Teams.TeamID}}
}

const AddFromWhere = ({route}: Props) => {
  const nav = useSafeNavigation()
  const storeTeamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  const prepareAddMembersWizard = Teams.useTeamsState(s => s.dispatch.prepareAddMembersWizard)
  const teamID = route.params?.teamID ?? storeTeamID
  const newTeam = teamID === T.Teams.newTeamWizardTeamID
  // Clicking "skip" concludes the new team wizard. It can error so we should display that here.
  const createTeamError = Teams.useTeamsState(s => (newTeam ? s.newTeamWizard.error : undefined))
  React.useEffect(() => {
    const routeTeamID = route.params?.teamID
    if (routeTeamID && routeTeamID !== storeTeamID) {
      prepareAddMembersWizard(routeTeamID)
    }
  }, [prepareAddMembersWizard, route.params?.teamID, storeTeamID])
  const appendNewTeamBuilder = C.Router2.appendNewTeamBuilder
  const onContinueKeybase = () => appendNewTeamBuilder(teamID)
  const onContinuePhone = () => nav.safeNavigateAppend({name: 'teamAddToTeamPhone', params: {}})
  const onContinueContacts = () => nav.safeNavigateAppend({name: 'teamAddToTeamContacts', params: {}})
  const onContinueEmail = () => nav.safeNavigateAppend({name: 'teamAddToTeamEmail', params: {}})

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
      flex: 1,
    },
    isMobile: {
      ...Kb.Styles.globalStyles.flexOne,
      ...Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.small),
    },
  }),
}))

export default AddFromWhere
