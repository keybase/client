import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {type AddMembersWizard} from './state'
import CardChoice from '../common/card-choice'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {
  wizard: AddMembersWizard
}

const AddFromWhere = ({wizard}: Props) => {
  const nav = useSafeNavigation()
  const isNewTeam = wizard.teamID === T.Teams.newTeamWizardTeamID
  const navigateAppend = C.Router2.navigateAppend
  const createTeamError = isNewTeam ? wizard.newTeamWizard?.error : undefined
  const onContinueKeybase = () =>
    navigateAppend({
      name: 'teamsTeamBuilder',
      params: {
        addMembersWizard: wizard,
        filterServices: ['keybase', 'twitter', 'facebook', 'github', 'reddit', 'hackernews'],
        goButtonLabel: 'Add',
        namespace: 'teams',
        teamID: wizard.teamID,
        title: '',
      },
    })
  const onContinuePhone = () => nav.safeNavigateAppend({name: 'teamAddToTeamPhone', params: {wizard}})
  const onContinueContacts = () => nav.safeNavigateAppend({name: 'teamAddToTeamContacts', params: {wizard}})
  const onContinueEmail = () => nav.safeNavigateAppend({name: 'teamAddToTeamEmail', params: {wizard}})

  return (
    <Kb.ModalScreen banner={<Kb.ErrorBanner error={createTeamError} />}>
      <Kb.Box2 direction="vertical" gap={isMobile ? 'tiny' : 'xsmall'} fullWidth={true}>
        <Kb.Text type="Body">
          {isNewTeam ? 'Where will your first team members come from?' : 'How would you like to add people?'}
        </Kb.Text>
        <CardChoice
          icon="icon-teams-add-search-64"
          title="From Keybase"
          subtitle="Search users by username."
          onClick={onContinueKeybase}
        />
        <CardChoice
          icon="icon-teams-add-email-list-64"
          title="A list of email addresses"
          subtitle="Enter one or multiple email addresses."
          onClick={onContinueEmail}
        />
        {isMobile && (
          <CardChoice
            icon="icon-teams-add-phone-contacts-64"
            title="From your contacts"
            subtitle="Add your friends, family, or colleagues."
            onClick={onContinueContacts}
          />
        )}
        <CardChoice
          icon="icon-teams-add-number-list-64"
          title="A list of phone numbers"
          subtitle="Enter one or multiple phone numbers"
          onClick={onContinuePhone}
        />
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

export default AddFromWhere
