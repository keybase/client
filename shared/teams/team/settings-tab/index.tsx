import * as React from 'react'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {InlineDropdown} from '@/common-adapters/dropdown'
import {FloatingRolePicker} from '@/teams/role-picker'
import {pluralize} from '@/util/string'
import RetentionPicker from './retention/container'
import DefaultChannels from './default-channels'

type Props = {
  allowOpenTrigger: number
  canShowcase: boolean
  error?: string
  isBigTeam: boolean
  ignoreAccessRequests: boolean
  publicityAnyMember: boolean
  publicityMember: boolean
  publicityTeam: boolean
  onEditWelcomeMessage: () => void
  openTeam: boolean
  openTeamRole: T.Teams.TeamRoleType
  savePublicity: (settings: T.Teams.PublicitySettings) => void
  showOpenTeamWarning: (isOpenTeam: boolean, teamname: string) => void
  teamID: T.Teams.TeamID
  yourOperations: T.Teams.TeamOperations
  waitingForWelcomeMessage: boolean
  welcomeMessage?: T.RPCChat.WelcomeMessageDisplay
  loadWelcomeMessage: () => void
  teamname: string
}

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: T.Teams.TeamRoleType) => void
  onOpenRolePicker: () => void
  newOpenTeamRole: T.Teams.TeamRoleType
  disabledReasonsForRolePicker: {[K in T.Teams.TeamRoleType]?: string}
}

type NewSettings = {
  newIgnoreAccessRequests: boolean
  newPublicityAnyMember: boolean
  newPublicityMember: boolean
  newPublicityTeam: boolean
  newOpenTeam: boolean
  newOpenTeamRole: T.Teams.TeamRoleType
}

type State = {
  publicitySettingsChanged: boolean
  isRolePickerOpen: boolean
} & NewSettings

type SettingName =
  | 'newPublicityMember'
  | 'newPublicityAnyMember'
  | 'newPublicityTeam'
  | 'newOpenTeam'
  | 'newIgnoreAccessRequests'
type SettingProps = {
  setBoolSettings: (key: SettingName) => (newSetting: boolean) => void
} & Props &
  State

const SetMemberShowcase = (props: SettingProps) => (
  <Kb.Box2 direction="vertical" style={styles.memberShowcase} alignSelf="flex-start">
    <Kb.Checkbox
      checked={props.newPublicityMember}
      disabled={!props.canShowcase}
      labelComponent={
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
          <Kb.Text style={props.canShowcase ? undefined : styles.grey} type="Body">
            Feature team on your own profile
          </Kb.Text>
          <Kb.Text type="BodySmall">
            {props.canShowcase
              ? 'Your profile will mention this team. Team description and number of members will be public.'
              : props.yourOperations.joinTeam
                ? 'You must join this team to feature it on your profile.'
                : "Admins aren't allowing members to feature this team on their profile."}
          </Kb.Text>
        </Kb.Box2>
      }
      onCheck={props.setBoolSettings('newPublicityMember')}
      style={styles.paddingRight}
    />
  </Kb.Box2>
)

const PublicityAnyMember = (props: SettingProps) =>
  props.yourOperations.setPublicityAny ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newPublicityAnyMember}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.shrink}>
            <Kb.Text type="Body">Allow non-admin members to feature the team on their profile</Kb.Text>
            <Kb.Text type="BodySmall">Team descriptions and number of members will be public.</Kb.Text>
          </Kb.Box2>
        }
        onCheck={props.setBoolSettings('newPublicityAnyMember')}
      />
    </Kb.Box2>
  ) : null

const teamsLink = 'keybase.io/popular-teams'

const PublicityTeam = (props: SettingProps) =>
  props.yourOperations.setTeamShowcase ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newPublicityTeam}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.shrink}>
            <Kb.Text type="Body">
              Publicize this team on{' '}
              <Kb.Text type="BodyPrimaryLink" onClickURL={`https://${teamsLink}`}>
                {teamsLink}
              </Kb.Text>
            </Kb.Text>
            <Kb.Text type="BodySmall">Team descriptions and number of members will be public.</Kb.Text>
          </Kb.Box2>
        }
        onCheck={props.setBoolSettings('newPublicityTeam')}
      />
    </Kb.Box2>
  ) : null

const OpenTeam = (props: SettingProps & RolePickerProps & {showWarning: () => void}) => {
  if (!props.yourOperations.changeOpenTeam) {
    return null
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
                floatingContainerStyle={styles.floatingRolePicker}
                onConfirm={props.onConfirmRolePicker}
                onCancel={props.onCancelRolePicker}
                position="bottom center"
                open={props.isRolePickerOpen}
                disabledRoles={props.disabledReasonsForRolePicker}
                presetRole={props.newOpenTeamRole}
                plural={true}
              >
                <InlineDropdown
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

const IgnoreAccessRequests = (props: SettingProps) =>
  !props.newOpenTeam && props.yourOperations.changeTarsDisabled ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.publicitySettings} alignSelf="flex-start">
      <Kb.Checkbox
        checked={props.newIgnoreAccessRequests}
        labelComponent={
          <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
            <Kb.Text type="Body">Don't allow requests to join this team</Kb.Text>
            <Kb.Text type="BodySmall">
              Requests to join this team will be silently ignored by all admins.
            </Kb.Text>
          </Kb.Box2>
        }
        onCheck={props.setBoolSettings('newIgnoreAccessRequests')}
      />
    </Kb.Box2>
  ) : null

// TODO: break out some of these into individual components, simplify state
export class Settings extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = this._getNewStateObject(props)
  }

  _getNewStateObject = (p: Props) => {
    return {
      isRolePickerOpen: false,
      newIgnoreAccessRequests: p.ignoreAccessRequests,
      newOpenTeam: p.openTeam,
      newOpenTeamRole: p.openTeamRole,
      newPublicityAnyMember: p.publicityAnyMember,
      newPublicityMember: p.publicityMember,
      newPublicityTeam: p.publicityTeam,
      publicitySettingsChanged: false,
      selectedOpenTeamRole: p.openTeamRole,
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.ignoreAccessRequests !== prevProps.ignoreAccessRequests ||
      this.props.openTeam !== prevProps.openTeam ||
      this.props.openTeamRole !== prevProps.openTeamRole ||
      this.props.publicityAnyMember !== prevProps.publicityAnyMember ||
      this.props.publicityMember !== prevProps.publicityMember ||
      this.props.publicityTeam !== prevProps.publicityTeam
    ) {
      this.setState(this._getNewStateObject(this.props))
      return
    }

    this.setState((prevState: State) => {
      const publicitySettingsChanged =
        prevState.newIgnoreAccessRequests !== this.props.ignoreAccessRequests ||
        prevState.newOpenTeam !== this.props.openTeam ||
        (!prevState.isRolePickerOpen && prevState.newOpenTeamRole !== this.props.openTeamRole) ||
        prevState.newPublicityAnyMember !== this.props.publicityAnyMember ||
        prevState.newPublicityMember !== this.props.publicityMember ||
        prevState.newPublicityTeam !== this.props.publicityTeam

      if (publicitySettingsChanged !== prevState.publicitySettingsChanged) {
        if (!prevState.isRolePickerOpen) {
          this.onSaveSettings()
        }
        return {publicitySettingsChanged}
      }

      return null
    })

    if (this.props.allowOpenTrigger !== prevProps.allowOpenTrigger) {
      this.setBoolSettings('newOpenTeam')(!this.state.newOpenTeam)
    }
  }

  // TODO just use real keys/setState and not this abstraction
  setBoolSettings =
    (key: SettingName) =>
    (newSetting: boolean): void => {
      this.setState({[key]: newSetting} as any)
    }

  onSaveSettings = () => {
    this.props.savePublicity({
      ignoreAccessRequests: this.state.newIgnoreAccessRequests,
      openTeam: this.state.newOpenTeam,
      openTeamRole: this.state.newOpenTeamRole,
      publicityAnyMember: this.state.newPublicityAnyMember,
      publicityMember: this.state.newPublicityMember,
      publicityTeam: this.state.newPublicityTeam,
    })
  }

  _showOpenTeamWarning = () => {
    this.props.showOpenTeamWarning(!this.state.newOpenTeam, this.props.teamname)
  }

  render() {
    const rolePickerProps = (() => ({
      disabledReasonsForRolePicker: {
        admin: `Users can't join open teams as admins.`,
        owner: `Users can't join open teams as owners.`,
        reader: '',
        writer: '',
      },
      isRolePickerOpen: this.state.isRolePickerOpen,
      newOpenTeamRole: this.state.newOpenTeamRole,
      onCancelRolePicker: () => this.setState({isRolePickerOpen: false}),
      onConfirmRolePicker: (role: State['newOpenTeamRole']) =>
        this.setState({isRolePickerOpen: false, newOpenTeamRole: role}),
      onOpenRolePicker: () => this.setState({isRolePickerOpen: true}),
    }))()

    const submenuProps: SettingProps = {
      ...this.props,
      ...this.state,
      setBoolSettings: this.setBoolSettings,
    }

    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outerBox}>
        <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.main}>
          {!!this.props.error && <Kb.Banner color="red">{this.props.error}</Kb.Banner>}
          <SetMemberShowcase {...submenuProps} />
          {(this.props.yourOperations.changeOpenTeam ||
            this.props.yourOperations.setTeamShowcase ||
            this.props.yourOperations.setPublicityAny) && (
            <>
              <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={styles.teamPadding}>
                <Kb.Text type="Header">Team</Kb.Text>
              </Kb.Box2>
              <PublicityAnyMember {...submenuProps} />
              <PublicityTeam {...submenuProps} />
              <OpenTeam {...submenuProps} {...rolePickerProps} showWarning={this._showOpenTeamWarning} />
              <IgnoreAccessRequests {...submenuProps} />
            </>
          )}
          {this.props.yourOperations.chat && (
            <RetentionPicker
              containerStyle={{marginTop: Kb.Styles.globalMargins.small}}
              showSaveIndicator={false}
              teamID={this.props.teamID}
              entityType={this.props.isBigTeam ? 'big team' : 'small team'}
            />
          )}
          <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" gapStart={true}>
            {this.props.isBigTeam && (
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <DefaultChannels teamID={this.props.teamID} />
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: {
    justifyContent: 'center',
    paddingBottom: C.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.small,
    paddingTop: C.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.small,
  },
  floatingRolePicker: Kb.Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  grey: {color: Kb.Styles.globalColors.black_50},
  header: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    marginBottom: Kb.Styles.globalMargins.tiny,
  },
  joinAs: Kb.Styles.platformStyles({
    isElectron: {paddingRight: Kb.Styles.globalMargins.xtiny},
  }),
  main: {
    alignSelf: 'flex-start',
    backgroundColor: Kb.Styles.globalColors.white,
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: 'flex-start',
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
  shrink: {flex: 1},
  spinner: {paddingLeft: Kb.Styles.globalMargins.xtiny},
  teamPadding: {paddingTop: Kb.Styles.globalMargins.small},
  welcomeMessage: {paddingRight: Kb.Styles.globalMargins.small},
  welcomeMessageBorder: {
    alignSelf: 'stretch',
    backgroundColor: Kb.Styles.globalColors.grey,
    paddingLeft: Kb.Styles.globalMargins.xtiny,
  },
  welcomeMessageCard: {paddingBottom: Kb.Styles.globalMargins.tiny},
  welcomeMessageContainer: {position: 'relative'},
}))
