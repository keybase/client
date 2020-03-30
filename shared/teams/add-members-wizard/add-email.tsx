import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/teams'
import {ModalTitle} from '../common'

type Props = {
  teamID: Types.TeamID
  errorMessage: string
}

const AddEmail = (props: Props) => {
  const [invitees, setInvitees] = React.useState('')

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  const disabled = invitees.length < 1

  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)

  // TODO Y2K-1556 useRPC to get assertions to pass to this action
  const onContinue = () => dispatch(TeamsGen.createAddMembersWizardPushMembers({members: []}))

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Email list" />,
      }}
      allowOverflow={true}
      footer={{
        content: <Kb.Button fullWidth={true} label="Continue" onClick={onContinue} disabled={disabled} />,
      }}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'tiny' : 'xsmall'}
      >
        <Kb.Text type="Body">Enter one or multiple email addresses:</Kb.Text>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} alignItems="flex-start">
          <Kb.LabeledInput
            autoFocus={true}
            error={!!props.errorMessage}
            multiline={true}
            onChangeText={text => setInvitees(text)}
            placeholder="Email addresses"
            hoverPlaceholder="Ex: daniel@domain.com, kim@domain.com, etc."
            rowsMin={3}
            rowsMax={8}
            value={invitees}
          />
          {!!props.errorMessage && (
            <Kb.Text type="BodySmall" style={styles.errorText}>
              {props.errorMessage}
            </Kb.Text>
          )}
        </Kb.Box2>
        <Kb.Text type="BodySmall">Separate all addresses with commas.</Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {minHeight: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  errorText: {color: Styles.globalColors.redDark},
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default AddEmail
