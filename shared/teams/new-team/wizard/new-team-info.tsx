import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {pluralize} from '../../../util/string'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {FloatingRolePicker} from '../../role-picker'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import debounce from 'lodash/debounce'

const getTeamTakenMessage = (status: number): string => {
  switch (status) {
    case RPCTypes.StatusCode.scteambadnamereserveddb:
      return 'This name is reserved by the Keybase team, possibly for your organization. Contact chris@keybase.io to claim it.'

    case RPCTypes.StatusCode.scteamnameconflictswithuser:
    case RPCTypes.StatusCode.scteamexists:
    default:
      return 'This team name is already taken'
  }
}

const NewTeamInfo = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamWizardState = Container.useSelector(state => state.teams.newTeamWizard)
  const parentName = Container.useSelector(state =>
    teamWizardState.parentTeamID
      ? Constants.getTeamNameFromID(state, teamWizardState.parentTeamID)
      : undefined
  )

  const [name, _setName] = React.useState(teamWizardState.name)
  const teamname = parentName ? `${parentName}.${name}` : name
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_]/, ''))
  const [teamNameTakenStatus, setTeamNameTakenStatus] = React.useState<number>(0)
  const [teamNameTaken, setTeamNameTaken] = React.useState(false)

  // TODO this should check subteams too (ideally in go)
  // Also it shouldn't leak the names of subteams people make to the server
  const checkTeamNameTaken = React.useCallback(
    debounce(Container.useRPC(RPCTypes.teamsUntrustedTeamExistsRpcPromise), 100),
    []
  )
  React.useEffect(() => {
    if (name.length >= 3) {
      checkTeamNameTaken(
        [{teamName: {parts: teamname.split('.')}}],
        ({exists, status}) => {
          setTeamNameTaken(exists)
          setTeamNameTakenStatus(status)
        },
        () => {} // TODO: handle errors?
      )
    } else {
      setTeamNameTaken(false)
      setTeamNameTakenStatus(0)
    }
  }, [teamname, name.length, setTeamNameTaken, checkTeamNameTaken, setTeamNameTakenStatus])

  const [description, setDescription] = React.useState(teamWizardState.description)
  const [openTeam, setOpenTeam] = React.useState(
    teamWizardState.name ? teamWizardState.open : teamWizardState.teamType === 'community'
  )
  const [addYourself, setAddYourself] = React.useState(teamWizardState.addYourself)
  const [showcase, setShowcase] = React.useState(
    teamWizardState.name
      ? teamWizardState.showcase
      : teamWizardState.teamType !== 'other' && teamWizardState.teamType !== 'subteam'
  )
  const [selectedRole, setSelectedRole] = React.useState<Types.TeamRoleType>(teamWizardState.openTeamJoinRole)
  const [rolePickerIsOpen, setRolePickerIsOpen] = React.useState(false)

  const continueDisabled = rolePickerIsOpen || teamNameTaken || name.length < 3

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())
  const onContinue = () =>
    dispatch(
      TeamsGen.createSetTeamWizardNameDescription({
        addYourself,
        description,
        openTeam,
        openTeamJoinRole: selectedRole,
        showcase,
        teamname,
      })
    )

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{
        leftButton:
          teamWizardState.teamType === 'subteam' ? (
            undefined
          ) : (
            <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />
          ),
        title: (
          <ModalTitle
            teamID={teamWizardState.parentTeamID ?? Types.newTeamWizardTeamID}
            title={teamWizardState.teamType === 'subteam' ? 'Create a subteam' : 'Enter team info'}
          />
        ),
      }}
      footer={{
        content: (
          <Kb.Button label="Continue" onClick={onContinue} fullWidth={true} disabled={continueDisabled} />
        ),
      }}
      allowOverflow={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.body} gap="tiny">
        {parentName ? (
          <Kb.NewInput
            autoFocus={true}
            maxLength={16}
            onChangeText={setName}
            prefix={`${parentName}.`}
            placeholder="subteam"
            value={name}
            containerStyle={styles.subteamNameInput}
          />
        ) : (
          <Kb.LabeledInput
            autoFocus={true}
            maxLength={16}
            onChangeText={setName}
            placeholder="Team name"
            value={name}
          />
        )}
        {teamNameTaken ? (
          <Kb.Text type="BodySmallError" style={styles.extraLineText}>
            {getTeamTakenMessage(teamNameTakenStatus)}
          </Kb.Text>
        ) : (
          <Kb.Text type="BodySmall">
            {teamWizardState.teamType === 'subteam'
              ? `Subteam names can be changed anytime.`
              : `Choose wisely. Team names are unique and can't be changed in the future.`}
          </Kb.Text>
        )}
        <Kb.LabeledInput
          hoverPlaceholder={
            teamWizardState.teamType === 'subteam'
              ? 'What is this subteam about?'
              : 'What is your team about?'
          }
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
                      textWrapperType="BodySmall"
                    />
                  </FloatingRolePicker>
                </Kb.Box2>
              )}
            </Kb.Box2>
          }
          checked={openTeam}
          onCheck={v => (rolePickerIsOpen ? undefined : setOpenTeam(v))}
        />
        {teamWizardState.teamType === 'subteam' && (
          <Kb.Checkbox onCheck={setAddYourself} checked={addYourself} label="Add yourself to the team" />
        )}
        <Kb.Checkbox
          onCheck={setShowcase}
          checked={addYourself && showcase}
          disabled={!addYourself}
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
  subteamNameInput: Styles.padding(Styles.globalMargins.tiny),
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
