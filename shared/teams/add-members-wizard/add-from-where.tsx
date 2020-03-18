import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {appendNewTeamBuilder, appendTeamsContactsTeamBuilder} from '../../actions/typed-routes'
import {ModalTitle} from '../common'

const AddFromWhere = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)
  const teamname = Container.useSelector(s => Constants.getTeamMeta(s, teamID).teamname)
  const newTeam: boolean = teamID === Types.newTeamWizardTeamID

  const onClose = () => dispatch(TeamsGen.createCancelAddMembersWizard())
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onSkip = () => dispatch(TeamsGen.createFinishNewTeamWizard())
  const onContinueKeybase = () => dispatch(appendNewTeamBuilder(teamID))
  const onContinuePhone = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamPhone']}))
  const onAddFromContacts = () => dispatch(appendTeamsContactsTeamBuilder(teamID))
  const onContinueEmail = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamEmail']}))
  return (
    <Kb.Modal
      allowOverflow={true}
      onClose={onClose}
      header={{
        leftButton: newTeam ? (
          <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />
        ) : Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ) : (
          undefined
        ),
        rightButton: newTeam ? (
          Styles.isMobile ? (
            <Kb.Text type="BodyBigLink" onClick={onSkip}>
              Skip
            </Kb.Text>
          ) : (
            <Kb.Button mode="Secondary" label="Skip" small={true} onClick={onSkip} />
          )
        ) : (
          undefined
        ),
        title: (
          <ModalTitle
            title={Styles.isMobile ? 'Add/Invite people' : 'Add or invite people'}
            teamname={teamname}
          />
        ),
      }}
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
            onClick={onAddFromContacts}
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
  body: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blueGrey},
    isElectron: {
      ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, Styles.globalMargins.xlarge),
      borderBottomRadius: 4,
      minHeight: 479,
    },
    isMobile: {
      ...Styles.globalStyles.flexOne,
      ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
    },
  }),
}))

export default AddFromWhere
