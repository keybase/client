import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {ModalTitle} from '../common'

type Props = {
  newTeam?: boolean
  onContinue: (where: 'keybase' | 'email' | 'contacts' | 'phone') => void
  teamID: Types.TeamID
}

const EnableContacts = ({newTeam, onContinue, teamID}: Props) => {
  const dispatch = Container.useDispatch()
  const {teamname} = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  return (
    <Kb.Modal
      allowOverflow={true}
      header={{
        leftButton: newTeam ? (
          <Kb.Icon type="iconfont-arrow-left" />
        ) : Styles.isMobile ? (
          <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
        ) : (
          undefined
        ),
        rightButton: newTeam ? (
          Styles.isMobile ? (
            <Kb.Text type="BodyBigLink">Skip</Kb.Text>
          ) : (
            <Kb.Button mode="Secondary" label="Skip" small={true} />
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
          onClick={() => onContinue('keybase')}
        />
        <Kb.RichButton
          icon="icon-teams-add-email-list-64"
          title="A list of email addresses"
          description="Enter one or multiple email addresses."
          onClick={() => onContinue('email')}
        />
        {Styles.isMobile && (
          <Kb.RichButton
            icon="icon-teams-add-phone-contacts-64"
            title="From your contacts"
            description="Add your friends, family, or colleagues."
            onClick={() => onContinue('contacts')}
          />
        )}
        <Kb.RichButton
          icon="icon-teams-add-number-list-64"
          title="A list of phone numbers"
          description="Enter one or multiple phone numbers"
          onClick={() => onContinue('phone')}
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
    },
    isMobile: {
      ...Styles.globalStyles.flexOne,
      ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
    },
  }),
}))

export default EnableContacts
