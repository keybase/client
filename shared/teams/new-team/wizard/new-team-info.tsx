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
      return Styles.isMobile
        ? 'This team name is reserved by the Keybase team. Contact reservations@keybase.io to claim it.'
        : 'This team name is reserved by the Keybase team, possibly for your organization. Contact reservations@keybase.io to claim it.'

    case RPCTypes.StatusCode.scteamnameconflictswithuser:
    case RPCTypes.StatusCode.scteamexists:
    default:
      return 'This team name is already taken.'
  }
}

const cannotJoinAsOwner = {admin: `Users can't join open teams as admins`, owner: null}

const NewTeamInfo = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamWizardState = Container.useSelector(state => state.teams.newTeamWizard)
  const parentName = Container.useSelector(state =>
    teamWizardState.parentTeamID
      ? Constants.getTeamNameFromID(state, teamWizardState.parentTeamID)
      : undefined
  )
  const minLength = parentName ? 2 : 3

  const [name, _setName] = React.useState(teamWizardState.name.substr(parentName ? parentName.length + 1 : 0))
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
    if (name.length >= minLength) {
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
  }, [teamname, name.length, setTeamNameTaken, checkTeamNameTaken, setTeamNameTakenStatus, minLength])

  const [description, setDescription] = React.useState(teamWizardState.description)
  const [openTeam, _setOpenTeam] = React.useState(
    teamWizardState.name ? teamWizardState.open : teamWizardState.teamType === 'community'
  )
  const setOpenTeam = () => {
    if (Styles.isMobile) {
      Kb.LayoutAnimation.configureNext(Kb.LayoutAnimation.Presets.easeInEaseOut)
    }
    _setOpenTeam(!openTeam)
  }
  const [addYourself, setAddYourself] = React.useState(teamWizardState.addYourself)
  const [showcase, setShowcase] = React.useState(
    teamWizardState.name
      ? teamWizardState.profileShowcase
      : teamWizardState.teamType !== 'other' && teamWizardState.teamType !== 'subteam'
  )
  const [realRole, setRealRole] = React.useState<Types.TeamRoleType>(teamWizardState.openTeamJoinRole)
  const [rolePickerIsOpen, setRolePickerIsOpen] = React.useState(false)

  const continueDisabled = rolePickerIsOpen || teamNameTaken || name.length < minLength

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())
  const onContinue = () =>
    dispatch(
      TeamsGen.createSetTeamWizardNameDescription({
        addYourself,
        description,
        openTeam,
        openTeamJoinRole: realRole,
        profileShowcase: showcase,
        teamname,
      })
    )

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={parentName ? onClose : undefined} // This is the first page of the process for subteams only
      header={{
        leftButton:
          teamWizardState.teamType === 'subteam' ? (
            Styles.isMobile ? (
              <Kb.Text type="BodyBigLink" onClick={onClose}>
                Cancel
              </Kb.Text>
            ) : (
              undefined
            )
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
      backgroundStyle={styles.bg}
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
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.extraLineText}>
          {teamNameTaken ? (
            <Kb.Text type="BodySmallError" style={styles.biggerOnTheInside}>
              {getTeamTakenMessage(teamNameTakenStatus)}
            </Kb.Text>
          ) : (
            <Kb.Text type="BodySmall">
              {teamWizardState.teamType === 'subteam'
                ? `Subteam names can be changed anytime.`
                : `Choose wisely. Team names are unique and can't be changed in the future.`}
            </Kb.Text>
          )}
        </Kb.Box2>
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
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={Styles.globalStyles.flexOne}>
              <Kb.Text type="Body">Make it an open team</Kb.Text>
              <Kb.Text type="BodySmall">Anyone can join without admin approval.</Kb.Text>
              {(!Styles.isMobile || openTeam) && (
                <Kb.Box2
                  direction="horizontal"
                  gap="xtiny"
                  alignSelf="flex-start"
                  alignItems="center"
                  className={Styles.classNames('hideableDropdown', {hidden: !openTeam})}
                >
                  <Kb.Text type="BodySmall">People will join as</Kb.Text>
                  <FloatingRolePicker
                    presetRole={realRole}
                    floatingContainerStyle={styles.floatingRolePicker}
                    onConfirm={role => {
                      setRealRole(role)
                      setRolePickerIsOpen(false)
                    }}
                    onCancel={() => setRolePickerIsOpen(false)}
                    position="bottom center"
                    open={rolePickerIsOpen}
                    disabledRoles={cannotJoinAsOwner}
                    plural={true}
                  >
                    <InlineDropdown
                      label={pluralize(realRole)}
                      onPress={() => setRolePickerIsOpen(!rolePickerIsOpen)}
                      textWrapperType="BodySmall"
                    />
                  </FloatingRolePicker>
                </Kb.Box2>
              )}
            </Kb.Box2>
          }
          checked={openTeam}
          onCheck={rolePickerIsOpen ? () => {} : setOpenTeam}
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
  bg: {backgroundColor: Styles.globalColors.blueGrey},
  biggerOnTheInside: {height: 100},
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  extraLineText: {
    height: 36,
  },
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  subteamNameInput: Styles.padding(Styles.globalMargins.tiny),
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default NewTeamInfo
