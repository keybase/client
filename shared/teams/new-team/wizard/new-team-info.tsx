import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import {ModalTitle} from '@/teams/common'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {InlineDropdown} from '@/common-adapters/dropdown'
import {FloatingRolePicker} from '../../role-picker'

const getTeamTakenMessage = (status: T.RPCGen.StatusCode): string => {
  switch (status) {
    case T.RPCGen.StatusCode.scteambadnamereserveddb:
      return Kb.Styles.isMobile
        ? 'This team name is reserved by the Keybase team. Contact reservations@keybase.io to claim it.'
        : 'This team name is reserved by the Keybase team, possibly for your organization. Contact reservations@keybase.io to claim it.'

    case T.RPCGen.StatusCode.scteamnameconflictswithuser:
    case T.RPCGen.StatusCode.scteamexists:
    default:
      return 'This team name is already taken.'
  }
}

const cannotJoinAsOwner = {admin: `Users can't join open teams as admins`}

const NewTeamInfo = () => {
  const nav = Container.useSafeNavigation()
  const teamWizardState = C.useTeamsState(s => s.newTeamWizard)
  const parentName = C.useTeamsState(s =>
    teamWizardState.parentTeamID ? C.Teams.getTeamNameFromID(s, teamWizardState.parentTeamID) : undefined
  )

  const minLength = parentName ? 2 : 3

  const [name, _setName] = React.useState(
    teamWizardState.name.substring(parentName ? parentName.length + 1 : 0)
  )
  const teamname = parentName ? `${parentName}.${name}` : name
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_]/, ''))
  const [teamNameTakenStatus, setTeamNameTakenStatus] = React.useState<T.RPCGen.StatusCode>(
    T.RPCGen.StatusCode.scok
  )
  const [teamNameTaken, setTeamNameTaken] = React.useState(false)

  // TODO this should check subteams too (ideally in go)
  // Also it shouldn't leak the names of subteams people make to the server
  const checkTeam = C.useDebouncedCallback(C.useRPC(T.RPCGen.teamsUntrustedTeamExistsRpcPromise), 100)
  type TeamNameParams = Parameters<typeof checkTeam>
  const checkTeamNameTaken = React.useCallback(
    (teamNames: TeamNameParams[0], cb: TeamNameParams[1], eb: TeamNameParams[2]) => {
      checkTeam(teamNames, cb, eb)
    },
    [checkTeam]
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
    if (Kb.Styles.isMobile) {
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
  const [realRole, setRealRole] = React.useState<T.Teams.TeamRoleType>(teamWizardState.openTeamJoinRole)
  const [rolePickerIsOpen, setRolePickerIsOpen] = React.useState(false)

  const continueDisabled = rolePickerIsOpen || teamNameTaken || name.length < minLength

  const onBack = () => nav.safeNavigateUp()
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => clearModals()

  const setTeamWizardNameDescription = C.useTeamsState(s => s.dispatch.setTeamWizardNameDescription)

  const onContinue = () =>
    setTeamWizardNameDescription({
      addYourself,
      description,
      openTeam,
      openTeamJoinRole: realRole,
      profileShowcase: showcase,
      teamname,
    })

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={parentName ? onClose : undefined} // This is the first page of the process for subteams only
      header={{
        leftButton:
          teamWizardState.teamType === 'subteam' ? (
            Kb.Styles.isMobile ? (
              <Kb.Text type="BodyBigLink" onClick={onClose}>
                Cancel
              </Kb.Text>
            ) : undefined
          ) : (
            <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />
          ),
        title: (
          <ModalTitle
            teamID={teamWizardState.parentTeamID ?? T.Teams.newTeamWizardTeamID}
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
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={Kb.Styles.globalStyles.flexOne}>
              <Kb.Text type="Body">Make it an open team</Kb.Text>
              <Kb.Text type="BodySmall">Anyone can join without admin approval.</Kb.Text>
              {(!Kb.Styles.isMobile || openTeam) && (
                <Kb.Box2
                  direction="horizontal"
                  gap="xtiny"
                  alignSelf="flex-start"
                  alignItems="center"
                  className={Kb.Styles.classNames('hideableDropdown', {hidden: !openTeam})}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Kb.Styles.globalColors.blueGrey},
  biggerOnTheInside: {height: 100},
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  extraLineText: {
    height: 36,
  },
  floatingRolePicker: Kb.Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  subteamNameInput: Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
  wordBreak: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default NewTeamInfo
