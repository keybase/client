import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {type AddMembersWizard} from './state'
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
    <>
      {createTeamError ? (
        <Kb.Banner color="red" key="err">
          {createTeamError}
        </Kb.Banner>
      ) : null}
      <Kb.Box2
        direction="vertical"
        gap={isMobile ? 'tiny' : 'xsmall'}
        style={styles.body}
        fullWidth={true}
      >
        <Kb.Text type="Body">
          {isNewTeam ? 'Where will your first team members come from?' : 'How would you like to add people?'}
        </Kb.Text>
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-add-search-64" />}
          body={
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="BodySemibold">From Keybase</Kb.Text>
              <Kb.Text type="BodySmall">Search users by username.</Kb.Text>
            </Kb.Box2>
          }
          onClick={onContinueKeybase}
        />
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-add-email-list-64" />}
          body={
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="BodySemibold">A list of email addresses</Kb.Text>
              <Kb.Text type="BodySmall">Enter one or multiple email addresses.</Kb.Text>
            </Kb.Box2>
          }
          onClick={onContinueEmail}
        />
        {isMobile && (
          <Kb.ListItem
            type="Card"
            firstItem={true}
            icon={<Kb.IconAuto type="icon-teams-add-phone-contacts-64" />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodySemibold">From your contacts</Kb.Text>
                <Kb.Text type="BodySmall">Add your friends, family, or colleagues.</Kb.Text>
              </Kb.Box2>
            }
            onClick={onContinueContacts}
          />
        )}
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-add-number-list-64" />}
          body={
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="BodySemibold">A list of phone numbers</Kb.Text>
              <Kb.Text type="BodySmall">Enter one or multiple phone numbers</Kb.Text>
            </Kb.Box2>
          }
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
