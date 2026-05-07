import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {InlineDropdown} from '@/common-adapters/dropdown'
import {FloatingRolePicker} from '../../role-picker'
import {type NewTeamWizard} from './state'
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import {useLoadedTeam} from '../../team/use-loaded-team'

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
type TeamNameTakenResult = {exists: boolean; status: T.RPCGen.StatusCode; teamname: string}

type Props = {
  wizard: NewTeamWizard
}

type TeamWizard2TeamInfoParamList = {
  teamWizard2TeamInfo: {wizard: NewTeamWizard}
}

const NewTeamInfo = ({wizard: teamWizardState}: Props) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<TeamWizard2TeamInfoParamList, 'teamWizard2TeamInfo'>>()
  const parentTeamID = teamWizardState.parentTeamID ?? T.Teams.noTeamID
  const {
    teamMeta: {teamname: loadedParentName},
  } = useLoadedTeam(parentTeamID)
  const parentName = teamWizardState.parentTeamID ? loadedParentName : undefined
  const waitingOnParentTeam = !!teamWizardState.parentTeamID && !parentName

  const minLength = teamWizardState.parentTeamID ? 2 : 3

  const [name, _setName] = React.useState(
    teamWizardState.parentTeamID ? (teamWizardState.name.split('.').at(-1) ?? '') : teamWizardState.name
  )
  const teamname = parentName ? `${parentName}.${name}` : name
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_]/, ''))
  const [teamNameTakenResult, setTeamNameTakenResult] = React.useState<TeamNameTakenResult | undefined>()

  // TODO this should check subteams too (ideally in go)
  // Also it shouldn't leak the names of subteams people make to the server
  const checkTeam = C.useDebouncedCallback(C.useRPC(T.RPCGen.teamsUntrustedTeamExistsRpcPromise), 100)
  const canCheckTeamName = !waitingOnParentTeam && name.length >= minLength

  React.useEffect(() => {
    if (!canCheckTeamName) {
      return
    }
    checkTeam(
      [{teamName: {parts: teamname.split('.')}}],
      ({exists, status}) => {
        setTeamNameTakenResult({exists, status, teamname})
      },
      () => {} // TODO: handle errors?
    )
  }, [teamname, checkTeam, canCheckTeamName])

  const visibleTeamNameTakenResult =
    canCheckTeamName && teamNameTakenResult?.teamname === teamname ? teamNameTakenResult : undefined
  const teamNameTaken = visibleTeamNameTakenResult?.exists ?? false
  const teamNameTakenStatus = visibleTeamNameTakenResult?.status ?? T.RPCGen.StatusCode.scok

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

  const continueDisabled = waitingOnParentTeam || rolePickerIsOpen || teamNameTaken || name.length < minLength

  const navigateAppend = C.Router2.navigateAppend

  const onContinue = () => {
    const wizard = {
      ...teamWizardState,
      addYourself,
      description,
      error: undefined,
      name: teamname,
      open: openTeam,
      openTeamJoinRole: realRole,
      profileShowcase: showcase,
    }
    navigation.setParams({wizard})
    navigateAppend({
      name: 'profileEditAvatar',
      params: {
        createdTeam: true,
        newTeamWizard: wizard,
        teamID: T.Teams.newTeamWizardTeamID,
        wizard: true,
      },
    })
  }

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.body} gap="tiny">
        {parentName ? (
          <Kb.Input3
            autoFocus={true}
            disabled={waitingOnParentTeam}
            maxLength={16}
            onChangeText={setName}
            prefix={`${parentName}.`}
            placeholder="subteam"
            value={name}
            containerStyle={styles.subteamNameInput}
          />
        ) : (
          <Kb.Input3
            autoFocus={true}
            disabled={waitingOnParentTeam}
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
          ) : waitingOnParentTeam ? (
            <Kb.Text type="BodySmall">Loading parent team info…</Kb.Text>
          ) : (
            <Kb.Text type="BodySmall">
              {teamWizardState.teamType === 'subteam'
                ? `Subteam names can be changed anytime.`
                : `Choose wisely. Team names are unique and can't be changed in the future.`}
            </Kb.Text>
          )}
        </Kb.Box2>
        <Kb.Input3
          disabled={waitingOnParentTeam}
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
          disabled={waitingOnParentTeam}
          onCheck={rolePickerIsOpen ? () => {} : setOpenTeam}
        />
        {teamWizardState.teamType === 'subteam' && (
          <Kb.Checkbox
            onCheck={setAddYourself}
            checked={addYourself}
            disabled={waitingOnParentTeam}
            label="Add yourself to the team"
          />
        )}
        <Kb.Checkbox
          onCheck={setShowcase}
          checked={addYourself && showcase}
          disabled={!addYourself}
          label="Feature team on your profile"
          labelSubtitle="Your profile will mention this team. Team description and number of members will be public."
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.Button label="Continue" onClick={onContinue} fullWidth={true} disabled={continueDisabled} />
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  biggerOnTheInside: {height: 100},
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  extraLineText: {
    height: 36,
  },
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  subteamNameInput: Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
}))

export default NewTeamInfo
