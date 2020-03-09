import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {pluralize} from '../../../util/string'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {FloatingRolePicker} from '../../role-picker'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'

const NewTeamInfo = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamWizardState = Container.useSelector(state => state.teams.newTeamWizard)

  const [name, setName] = React.useState(teamWizardState.name)
  const [teamNameTakenError, setTeamNameTakenError] = React.useState<string | null>(null)
  const [teamNameTaken, setTeamNameTaken] = React.useState(false)
  const checkTeamNameTaken = Container.useRPC(RPCTypes.teamsUntrustedTeamExistsRpcPromise)
  React.useEffect(() => {
    if (name.length >= 3) {
      checkTeamNameTaken(
        [{teamName: {parts: name.split('.')}}],
        taken => {
          setTeamNameTaken(taken)
          // setTeamNameTakenError('')
        },
        e => setTeamNameTakenError(e.message)
      )
    } else {
      setTeamNameTaken(false)
      setTeamNameTakenError(null)
    }
  }, [name, setTeamNameTaken, checkTeamNameTaken])

  const [description, setDescription] = React.useState(teamWizardState.description)
  const [openTeam, setOpenTeam] = React.useState(
    teamWizardState.name ? teamWizardState.open : teamWizardState.teamType === 'community'
  )
  const [showcase, setShowcase] = React.useState(
    teamWizardState.name ? teamWizardState.showcase : teamWizardState.teamType !== 'other'
  )
  const [selectedRole, setSelectedRole] = React.useState<Types.TeamRoleType>(teamWizardState.openTeamJoinRole)
  const [rolePickerIsOpen, setRolePickerIsOpen] = React.useState(false)

  const continueDisabled = rolePickerIsOpen || teamNameTaken || name.length < 3

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())
  const onContinue = () =>
    dispatch(
      TeamsGen.createSetTeamWizardNameDescription({
        description,
        openTeam,
        openTeamJoinRole: selectedRole,
        showcase,
        teamname: name,
      })
    )

  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname="New team" title="Enter team info" />,
      }}
      footer={{
        content: (
          <Kb.Button label="Continue" onClick={onContinue} fullWidth={true} disabled={continueDisabled} />
        ),
      }}
      allowOverflow={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="tiny">
        <Kb.LabeledInput
          placeholder="Team name"
          value={name}
          onChangeText={setName}
          maxLength={16}
          autoFocus={true}
        />
        {teamNameTaken ? (
          <Kb.Text type="BodySmallError" style={styles.extraLineText}>
            This team name is already taken. {teamNameTakenError}
          </Kb.Text>
        ) : (
          <Kb.Text type="BodySmall">
            Choose wisely. Team names are unique and can't be changed in the future.
          </Kb.Text>
        )}
        <Kb.LabeledInput
          hoverPlaceholder="What is your team about?"
          placeholder="Description"
          value={description}
          rowsMin={3}
          rowsMax={3}
          multiline={true}
          onChangeText={setDescription}
          maxLength={280}
        />

        <Kb.Checkbox
          labelComponent={
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.tallEnoughBox}>
              <Kb.Text type="Body">Make it an open team</Kb.Text>
              <Kb.Text type="BodySmall">Anyone can join without admin approval.</Kb.Text>
              {openTeam && (
                <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" alignItems="center">
                  <Kb.Text type="BodySmall">People will join as</Kb.Text>
                  <FloatingRolePicker
                    confirmLabel={`Let people in as ${pluralize(selectedRole)}`}
                    selectedRole={selectedRole}
                    onSelectRole={setSelectedRole}
                    floatingContainerStyle={styles.floatingRolePicker}
                    onConfirm={() => setRolePickerIsOpen(false)}
                    position="bottom center"
                    open={rolePickerIsOpen}
                  >
                    <InlineDropdown
                      label={pluralize(selectedRole)}
                      onPress={() => setRolePickerIsOpen(!rolePickerIsOpen)}
                      type="BodySmall"
                    />
                  </FloatingRolePicker>
                </Kb.Box2>
              )}
            </Kb.Box2>
          }
          checked={openTeam}
          onCheck={v => (rolePickerIsOpen ? undefined : setOpenTeam(v))}
        />
        <Kb.Checkbox
          onCheck={setShowcase}
          checked={showcase}
          label="Feature team on your profile"
          labelSubtitle="Your profile will mention this team. Team description and number of members will be public."
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
      borderRadius: 4,
    },
    isElectron: {minHeight: 420},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  extraLineText: {
    height: 34,
  },
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  tallEnoughBox: Styles.platformStyles({
    common: {flexShrink: 1},
    isElectron: {height: 48},
    isMobile: {height: 80},
  }),
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default NewTeamInfo
