import * as React from 'react'
import type * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {globalColors, globalMargins, styleSheetCreate, platformStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {FloatingRolePicker} from '../../role-picker'
import {pluralize} from '../../../util/string'
import type * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import RetentionPicker from './retention/container'
import * as Styles from '../../../styles'
import DefaultChannels from './default-channels'

type Props = {
  canShowcase: boolean
  error?: string
  isBigTeam: boolean
  ignoreAccessRequests: boolean
  publicityAnyMember: boolean
  publicityMember: boolean
  publicityTeam: boolean
  onEditWelcomeMessage: () => void
  openTeam: boolean
  openTeamRole: Types.TeamRoleType
  savePublicity: (settings: Types.PublicitySettings) => void
  showOpenTeamWarning: (isOpenTeam: boolean, onConfirm: () => void, teamname: string) => void
  teamID: Types.TeamID
  yourOperations: Types.TeamOperations
  waitingForWelcomeMessage: boolean
  welcomeMessage?: RPCChatTypes.WelcomeMessageDisplay
  loadWelcomeMessage: () => void
  teamname: string
}

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onOpenRolePicker: () => void
  newOpenTeamRole: Types.TeamRoleType
  disabledReasonsForRolePicker: {[K in Types.TeamRoleType]?: string}
}

type NewSettings = {
  newIgnoreAccessRequests: boolean
  newPublicityAnyMember: boolean
  newPublicityMember: boolean
  newPublicityTeam: boolean
  newOpenTeam: boolean
  newOpenTeamRole: Types.TeamRoleType
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
              direction={isMobile ? 'vertical' : 'horizontal'}
              alignItems={isMobile ? 'flex-start' : 'center'}
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
        onCheck={props.isRolePickerOpen ? null : props.showWarning}
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

const toRolePickerPropsHelper = (state: State, setState) => ({
  disabledReasonsForRolePicker: {
    admin: `Users can't join open teams as admins.`,
    owner: `Users can't join open teams as owners.`,
    reader: '',
    writer: '',
  },
  isRolePickerOpen: state.isRolePickerOpen,
  newOpenTeamRole: state.newOpenTeamRole,
  onCancelRolePicker: () => setState({isRolePickerOpen: false}),
  onConfirmRolePicker: role => setState({isRolePickerOpen: false, newOpenTeamRole: role}),
  onOpenRolePicker: () => setState({isRolePickerOpen: true}),
})

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
  }

  // TODO just use real keys/setState and not this abstraction
  setBoolSettings =
    (key: SettingName) =>
    (newSetting: boolean): void => {
      // @ts-ignore not sure how to type this
      this.setState({[key]: newSetting})
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
    this.props.showOpenTeamWarning(
      !this.state.newOpenTeam,
      () => this.setBoolSettings('newOpenTeam')(!this.state.newOpenTeam),
      this.props.teamname
    )
  }

  render() {
    const rolePickerProps = toRolePickerPropsHelper(this.state, s => this.setState(s))
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
              containerStyle={{marginTop: globalMargins.small}}
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

const styles = styleSheetCreate(() => ({
  button: {
    justifyContent: 'center',
    paddingBottom: isMobile ? globalMargins.tiny : globalMargins.small,
    paddingTop: isMobile ? globalMargins.tiny : globalMargins.small,
  },
  floatingRolePicker: platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  grey: {color: globalColors.black_50},
  header: {
    ...Styles.globalStyles.flexBoxRow,
    marginBottom: Styles.globalMargins.tiny,
  },
  joinAs: platformStyles({
    isElectron: {paddingRight: globalMargins.xtiny},
  }),
  main: {
    alignSelf: 'flex-start',
    backgroundColor: Styles.globalColors.white,
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: 'flex-start',
    maxWidth: 600,
    padding: globalMargins.small,
  },
  memberShowcase: {alignItems: 'flex-start', paddingRight: globalMargins.small},
  openDropdown: {width: 70},
  openTeam: {
    flexShrink: 1,
    paddingRight: globalMargins.small,
  },
  outerBox: {backgroundColor: Styles.globalColors.white},
  paddingRight: {paddingRight: globalMargins.xtiny},
  publicitySettings: {
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.small,
  },
  shrink: {flex: 1},
  spinner: {paddingLeft: Styles.globalMargins.xtiny},
  teamPadding: {paddingTop: globalMargins.small},
  welcomeMessage: {paddingRight: globalMargins.small},
  welcomeMessageBorder: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.grey,
    paddingLeft: Styles.globalMargins.xtiny,
  },
  welcomeMessageCard: {paddingBottom: Styles.globalMargins.tiny},
  welcomeMessageContainer: {position: 'relative'},
}))
