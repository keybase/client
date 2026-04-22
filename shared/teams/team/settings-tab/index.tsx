import * as React from 'react'
import * as C from '@/constants'
import {isBigTeam as getIsBigTeam} from '@/constants/chat/helpers'
import * as Chat from '@/stores/chat'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'
import {FloatingRolePicker} from '@/teams/role-picker'
import {pluralize} from '@/util/string'
import type {RPCError} from '@/util/errors'
import RetentionPicker from './retention'
import DefaultChannels from './default-channels'
import isEqual from 'lodash/isEqual'
import {useLoadedTeam} from '../use-loaded-team'
import {useSettingsTabState} from './use-settings'

type Props = {
  allowOpenTrigger: number
  canShowcase: boolean
  error?: string
  isBigTeam: boolean
  ignoreAccessRequests: boolean
  publicityAnyMember: boolean
  publicityMember: boolean
  publicityTeam: boolean
  openTeam: boolean
  openTeamRole: T.Teams.TeamRoleType
  savePublicity: (settings: T.Teams.PublicitySettings) => void
  showOpenTeamWarning: (isOpenTeam: boolean, teamname: string) => void
  teamID: T.Teams.TeamID
  teamname: string
  yourOperations: T.Teams.TeamOperations
}

const SetMemberShowcase = (props: {
  yourOperationsJoinTeam: boolean
  canShowcase: boolean
  newPublicityMember: boolean
  setNewPublicityMember: (s: boolean) => void
}) => (
  <Kb.Box2 direction="vertical" style={styles.memberShowcase} alignSelf="flex-start">
    <Kb.Checkbox
      checked={props.newPublicityMember}
      disabled={!props.canShowcase}
      labelComponent={
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
          <Kb.Text style={props.canShowcase ? undefined : styles.grey} type="Body">
            Feature team on your own profile
          </Kb.Text>
          <Kb.Text type="BodySmall">
            {props.canShowcase
              ? 'Your profile will mention this team. Team description and number of members will be public.'
              : props.yourOperationsJoinTeam
                ? 'You must join this team to feature it on your profile.'
                : "Admins aren't allowing members to feature this team on their profile."}
          </Kb.Text>
        </Kb.Box2>
      }
      onCheck={props.setNewPublicityMember}
      style={styles.paddingRight}
    />
  </Kb.Box2>
)

const PublicityAnyMember = (props: {
  newPublicityAnyMember: boolean
  setNewPublicityAnyMember: (s: boolean) => void
}) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newPublicityAnyMember}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
            <Kb.Text type="Body">Allow non-admin members to feature the team on their profile</Kb.Text>
            <Kb.Text type="BodySmall">Team descriptions and number of members will be public.</Kb.Text>
          </Kb.Box2>
        }
        onCheck={props.setNewPublicityAnyMember}
      />
    </Kb.Box2>
  )
}

const teamsLink = 'keybase.io/popular-teams'

const PublicityTeam = (props: {newPublicityTeam: boolean; setNewPublicityTeam: (s: boolean) => void}) => {
  const teamsLinkUrlProps = Kb.useClickURL(`https://${teamsLink}`)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newPublicityTeam}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
            <Kb.Text type="Body">
              Publicize this team on{' '}
              <Kb.Text type="BodyPrimaryLink" {...teamsLinkUrlProps}>
                {teamsLink}
              </Kb.Text>
            </Kb.Text>
            <Kb.Text type="BodySmall">Team descriptions and number of members will be public.</Kb.Text>
          </Kb.Box2>
        }
        onCheck={props.setNewPublicityTeam}
      />
    </Kb.Box2>
  )
}

const OpenTeam = (props: {
  showWarning: () => void
  newOpenTeam: boolean
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: T.Teams.TeamRoleType) => void
  onOpenRolePicker: () => void
  newOpenTeamRole: T.Teams.TeamRoleType
}) => {
  const disabledReasonsForRolePicker = {
    admin: `Users can't join open teams as admins.`,
    owner: `Users can't join open teams as owners.`,
    reader: '',
    writer: '',
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newOpenTeam}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.openTeam}>
            <Kb.Text type="Body">Make this an open team</Kb.Text>
            <Kb.Box2
              direction={C.isMobile ? 'vertical' : 'horizontal'}
              alignItems={C.isMobile ? 'flex-start' : 'center'}
              alignSelf="flex-start"
            >
              <Kb.Text style={styles.joinAs} type="BodySmall">
                Anyone will be able to join immediately. Users will join as
              </Kb.Text>
              <FloatingRolePicker

                onConfirm={props.onConfirmRolePicker}
                onCancel={props.onCancelRolePicker}
                position="bottom center"
                open={props.isRolePickerOpen}
                disabledRoles={disabledReasonsForRolePicker}
                presetRole={props.newOpenTeamRole}
                plural={true}
              >
                <Kb.InlineDropdown
                  label={pluralize(props.newOpenTeamRole)}
                  onPress={props.newOpenTeam ? props.onOpenRolePicker : () => {}}
                  textWrapperType="BodySmall"
                  style={styles.openDropdown}
                />
              </FloatingRolePicker>
            </Kb.Box2>
          </Kb.Box2>
        }
        onCheck={props.isRolePickerOpen ? undefined : props.showWarning}
      />
    </Kb.Box2>
  )
}

const IgnoreAccessRequests = (props: {
  newIgnoreAccessRequests: boolean
  setNewIgnoreAccessRequests: (s: boolean) => void
}) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newIgnoreAccessRequests}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
            <Kb.Text type="Body">{"Don't allow requests to join this team"}</Kb.Text>
            <Kb.Text type="BodySmall">
              Requests to join this team will be silently ignored by all admins.
            </Kb.Text>
          </Kb.Box2>
        }
        onCheck={props.setNewIgnoreAccessRequests}
      />
    </Kb.Box2>
  )
}

export const Settings = (p: Props) => {
  const {error, savePublicity, isBigTeam, teamID, yourOperations, teamname, showOpenTeamWarning} = p
  const {canShowcase, allowOpenTrigger} = p

  const [newPublicityAnyMember, setNewPublicityAnyMember] = React.useState(p.publicityAnyMember)
  const [newPublicityTeam, setNewPublicityTeam] = React.useState(p.publicityTeam)
  const [newIgnoreAccessRequests, setNewIgnoreAccessRequests] = React.useState(p.ignoreAccessRequests)
  const [newPublicityMember, setNewPublicityMember] = React.useState(p.publicityMember)
  const [isRolePickerOpen, setIsRolePickerOpen] = React.useState(false)
  const [newOpenTeam, setNewOpenTeam] = React.useState(p.openTeam)
  const [newOpenTeamRole, setNewOpenTeamRole] = React.useState<T.Teams.TeamRoleType>(p.openTeamRole)

  const lastAllowOpenTriggerRef = React.useRef(allowOpenTrigger)

  React.useEffect(() => {
    if (lastAllowOpenTriggerRef.current !== allowOpenTrigger) {
      lastAllowOpenTriggerRef.current = allowOpenTrigger
      setNewOpenTeam(o => !o)
    }
  }, [allowOpenTrigger])

  const lastSave = React.useRef({
    ignoreAccessRequests: newIgnoreAccessRequests,
    openTeam: newOpenTeam,
    openTeamRole: newOpenTeamRole,
    publicityAnyMember: newPublicityAnyMember,
    publicityMember: newPublicityMember,
    publicityTeam: newPublicityTeam,
  })
  React.useEffect(() => {
    const next = {
      ignoreAccessRequests: newIgnoreAccessRequests,
      openTeam: newOpenTeam,
      openTeamRole: newOpenTeamRole,
      publicityAnyMember: newPublicityAnyMember,
      publicityMember: newPublicityMember,
      publicityTeam: newPublicityTeam,
    }
    if (!isEqual(next, lastSave.current)) {
      lastSave.current = next
      savePublicity(next)
    }
  }, [savePublicity, newIgnoreAccessRequests, newOpenTeam, newOpenTeamRole, newPublicityAnyMember, newPublicityMember, newPublicityTeam])

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outerBox}>
      <Kb.Box2 direction="vertical" alignItems="flex-start" flex={1} style={styles.main} justifyContent="flex-start">
        {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
        <SetMemberShowcase
          yourOperationsJoinTeam={yourOperations.joinTeam}
          canShowcase={canShowcase}
          newPublicityMember={newPublicityMember}
          setNewPublicityMember={setNewPublicityMember}
        />
        {(yourOperations.changeOpenTeam ||
          yourOperations.setTeamShowcase ||
          yourOperations.setPublicityAny) && (
          <>
            <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={styles.teamPadding}>
              <Kb.Text type="Header">Team</Kb.Text>
            </Kb.Box2>
            {yourOperations.setPublicityAny ? (
              <PublicityAnyMember
                newPublicityAnyMember={newPublicityAnyMember}
                setNewPublicityAnyMember={setNewPublicityAnyMember}
              />
            ) : null}
            {yourOperations.setTeamShowcase ? (
              <PublicityTeam newPublicityTeam={newPublicityTeam} setNewPublicityTeam={setNewPublicityTeam} />
            ) : null}
            {yourOperations.changeOpenTeam ? (
              <OpenTeam
                newOpenTeam={newOpenTeam}
                showWarning={() => showOpenTeamWarning(!newOpenTeam, teamname)}
                isRolePickerOpen={isRolePickerOpen}
                newOpenTeamRole={newOpenTeamRole}
                onCancelRolePicker={() => setIsRolePickerOpen(false)}
                onConfirmRolePicker={(role: T.Teams.TeamRoleType) => {
                  setIsRolePickerOpen(false)
                  setNewOpenTeamRole(role)
                }}
                onOpenRolePicker={() => setIsRolePickerOpen(true)}
              />
            ) : null}
            {!newOpenTeam && yourOperations.changeTarsDisabled ? (
              <IgnoreAccessRequests
                newIgnoreAccessRequests={newIgnoreAccessRequests}
                setNewIgnoreAccessRequests={setNewIgnoreAccessRequests}
              />
            ) : null}
          </>
        )}
        {yourOperations.chat && (
          <RetentionPicker
            containerStyle={{marginTop: Kb.Styles.globalMargins.small}}
            showSaveIndicator={false}
            teamID={teamID}
            entityType={isBigTeam ? 'big team' : 'small team'}
          />
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" gapStart={true}>
          {isBigTeam && (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <DefaultChannels teamID={teamID} />
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  grey: {color: Kb.Styles.globalColors.black_50},
  joinAs: Kb.Styles.platformStyles({
    isElectron: {paddingRight: Kb.Styles.globalMargins.xtiny},
  }),
  main: {
    alignSelf: 'flex-start',
    backgroundColor: Kb.Styles.globalColors.white,
    flexBasis: 0,
    maxWidth: 600,
    padding: Kb.Styles.globalMargins.small,
  },
  memberShowcase: {alignItems: 'flex-start', paddingRight: Kb.Styles.globalMargins.small},
  openDropdown: {width: 70},
  openTeam: {
    flexShrink: 1,
    paddingRight: Kb.Styles.globalMargins.small,
  },
  outerBox: {backgroundColor: Kb.Styles.globalColors.white},
  paddingRight: {paddingRight: Kb.Styles.globalMargins.xtiny},
  publicitySettings: {
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: Kb.Styles.globalMargins.small,
  },
  teamPadding: {paddingTop: Kb.Styles.globalMargins.small},
}))

const callRPC = async <ARGS extends Array<any>, RET>(
  submit: (args: ARGS, setResult: (result: RET) => void, setError: (error: RPCError) => void) => void,
  args: ARGS
) => new Promise<RET>((resolve, reject) => submit(args, resolve, reject))

export type OwnProps = {
  teamID: T.Teams.TeamID
}

const Container = (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const {reload, teamDetails, teamMeta, yourOperations} = useLoadedTeam(teamID)
  const setGlobalError = useConfigState(s => s.dispatch.setGlobalError)
  const setTeamSettingsRPC = C.useRPC(T.RPCGen.teamsTeamSetSettingsRpcPromise)
  const setTarsDisabledRPC = C.useRPC(T.RPCGen.teamsSetTarsDisabledRpcPromise)
  const setTeamShowcaseRPC = C.useRPC(T.RPCGen.teamsSetTeamShowcaseRpcPromise)
  const setTeamMemberShowcaseRPC = C.useRPC(T.RPCGen.teamsSetTeamMemberShowcaseRpcPromise)
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamDetails.settings.teamShowcased
  const settings = teamDetails.settings
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const ignoreAccessRequests = teamDetails.settings.tarsDisabled
  const isBigTeam = Chat.useChatState(s => getIsBigTeam(s.inboxLayout, teamID))
  const openTeam = settings.open
  const openTeamRole = teamDetails.settings.openJoinAs
  const teamname = teamMeta.teamname
  const error = C.Waiting.useAnyErrors([
    C.waitingKeyTeamsSetMemberPublicity(teamID),
    C.waitingKeyTeamsSetRetentionPolicy(teamID),
  ])?.message
  const navigateAppend = C.Router2.navigateAppend
  const showOpenTeamWarning = (isOpenTeam: boolean, teamname: string) => {
    navigateAppend({name: 'openTeamWarning', params: {isOpenTeam, teamname}})
  }
  const allowOpenTrigger = useSettingsTabState(s => s.allowOpenTrigger)

  const savePublicity = React.useCallback(
    (settings: T.Teams.PublicitySettings) => {
      void (async () => {
        try {
          let changed = false
          if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
            changed = true
            await callRPC(setTeamSettingsRPC, [
              {
                settings: {joinAs: T.RPCGen.TeamRole[settings.openTeamRole], open: settings.openTeam},
                teamID,
              },
            ])
          }
          if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
            changed = true
            await callRPC(setTarsDisabledRPC, [{disabled: settings.ignoreAccessRequests, teamID}])
          }
          if (publicityAnyMember !== settings.publicityAnyMember) {
            changed = true
            await callRPC(setTeamShowcaseRPC, [{anyMemberShowcase: settings.publicityAnyMember, teamID}])
          }
          if (publicityMember !== settings.publicityMember) {
            changed = true
            await callRPC(setTeamMemberShowcaseRPC, [{isShowcased: settings.publicityMember, teamID}])
          }
          if (publicityTeam !== settings.publicityTeam) {
            changed = true
            await callRPC(setTeamShowcaseRPC, [{isShowcased: settings.publicityTeam, teamID}])
          }
          if (changed) {
            await reload()
          }
        } catch (error) {
          setGlobalError(error)
        }
      })()
    },
    [
      ignoreAccessRequests,
      openTeam,
      openTeamRole,
      publicityAnyMember,
      publicityMember,
      publicityTeam,
      reload,
      setGlobalError,
      setTarsDisabledRPC,
      setTeamMemberShowcaseRPC,
      setTeamSettingsRPC,
      setTeamShowcaseRPC,
      teamID,
    ]
  )

  // reset if incoming props change on us
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    setKey(k => k + 1)
  }, [ignoreAccessRequests, openTeam, openTeamRole, publicityAnyMember, publicityMember, publicityTeam])

  return (
    <Settings
      key={key}
      allowOpenTrigger={allowOpenTrigger}
      canShowcase={canShowcase}
      error={error}
      ignoreAccessRequests={ignoreAccessRequests}
      isBigTeam={isBigTeam}
      openTeam={openTeam}
      openTeamRole={openTeamRole}
      publicityAnyMember={publicityAnyMember}
      publicityMember={publicityMember}
      publicityTeam={publicityTeam}
      savePublicity={savePublicity}
      showOpenTeamWarning={showOpenTeamWarning}
      teamID={teamID}
      teamname={teamname}
      yourOperations={yourOperations}
    />
  )
}

export default Container
