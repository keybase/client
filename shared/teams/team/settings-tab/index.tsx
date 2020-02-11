import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {RetentionPolicy} from '../../../constants/types/retention-policy'
import * as Kb from '../../../common-adapters'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {globalColors, globalMargins, styleSheetCreate, platformStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {FloatingRolePicker} from '../../role-picker'
import {pluralize} from '../../../util/string'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import TeamJourney from '../../../chat/conversation/messages/cards/team-journey/index'
import RetentionPicker from './retention/container'
import * as Styles from '../../../styles'
import {renderWelcomeMessage} from '../../../util/journey-card'

type Props = {
  canShowcase: boolean
  error?: string
  isBigTeam: boolean
  ignoreAccessRequests: boolean
  publicityAnyMember: boolean
  publicityMember: boolean
  publicityTeam: boolean
  openTeam: boolean
  openTeamRole: Types.TeamRoleType
  savePublicity: (arg0: Types.PublicitySettings, arg1: boolean, arg2: RetentionPolicy | null) => void
  teamID: Types.TeamID
  yourOperations: Types.TeamOperations
  waitingForSavePublicity: boolean
  welcomeMessage: RPCChatTypes.WelcomeMessage | null
  loadWelcomeMessage: () => void
  teamname: string
}

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onOpenRolePicker: () => void
  onSelectRole: (role: Types.TeamRoleType) => void
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
  newRetentionPolicy: RetentionPolicy | null
}

type State = {
  publicitySettingsChanged: boolean
  retentionPolicyChanged: boolean
  retentionPolicyDecreased: boolean
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

const OpenTeam = (props: SettingProps & RolePickerProps) => {
  if (!props.yourOperations.changeOpenTeam) {
    return null
  }

  return (
    <Kb.Box2 direction="vertical" style={styles.publicitySettings} alignSelf="flex-start">
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
                confirmLabel={`Let in as ${pluralize(props.newOpenTeamRole)}`}
                selectedRole={props.newOpenTeamRole}
                onSelectRole={props.onSelectRole}
                floatingContainerStyle={styles.floatingRolePicker}
                onConfirm={props.onConfirmRolePicker}
                onCancel={props.onCancelRolePicker}
                position="bottom center"
                open={props.isRolePickerOpen}
                disabledRoles={props.disabledReasonsForRolePicker}
              >
                <InlineDropdown
                  label={pluralize(props.newOpenTeamRole)}
                  onPress={props.newOpenTeam ? props.onOpenRolePicker : () => {}}
                  type="BodySmall"
                />
              </FloatingRolePicker>
            </Kb.Box2>
          </Kb.Box2>
        }
        onCheck={props.isRolePickerOpen ? null : props.setBoolSettings('newOpenTeam')}
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
  onConfirmRolePicker: () => setState({isRolePickerOpen: false}),
  onOpenRolePicker: () => setState({isRolePickerOpen: true}),
  onSelectRole: (role: Types.TeamRoleType) =>
    setState({
      newOpenTeamRole: role,
    }),
})

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
      newRetentionPolicy: null,
      publicitySettingsChanged: false,
      retentionPolicyChanged: false,
      retentionPolicyDecreased: false,
    }
  }

  componentDidMount() {
    this.props.loadWelcomeMessage()
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
        prevState.newOpenTeamRole !== this.props.openTeamRole ||
        prevState.newPublicityAnyMember !== this.props.publicityAnyMember ||
        prevState.newPublicityMember !== this.props.publicityMember ||
        prevState.newPublicityTeam !== this.props.publicityTeam ||
        prevState.retentionPolicyChanged

      return publicitySettingsChanged !== prevState.publicitySettingsChanged
        ? {publicitySettingsChanged}
        : null
    })
  }

  // TODO just use real keys/setState and not this abstraction
  setBoolSettings = (key: SettingName) => (newSetting: boolean): void => {
    // @ts-ignore not sure how to type this
    this.setState({[key]: newSetting})
  }

  onSaveSettings = () => {
    this.props.savePublicity(
      {
        ignoreAccessRequests: this.state.newIgnoreAccessRequests,
        openTeam: this.state.newOpenTeam,
        openTeamRole: this.state.newOpenTeamRole,
        publicityAnyMember: this.state.newPublicityAnyMember,
        publicityMember: this.state.newPublicityMember,
        publicityTeam: this.state.newPublicityTeam,
      },
      this.state.retentionPolicyDecreased,
      this.state.newRetentionPolicy
    )
  }

  _onSelectRetentionPolicy = (
    newRetentionPolicy: RetentionPolicy,
    retentionPolicyChanged: boolean,
    retentionPolicyDecreased: boolean
  ) => {
    this.setState({newRetentionPolicy, retentionPolicyChanged, retentionPolicyDecreased})
  }

  render() {
    const rolePickerProps = toRolePickerPropsHelper(this.state, s => this.setState(s))
    const submenuProps: SettingProps = {
      ...this.props,
      ...this.state,
      setBoolSettings: this.setBoolSettings,
    }
    // TODO editor should be admin only, this is allowed to write
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} alignItems="flex-start" style={styles.main}>
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
            <OpenTeam {...submenuProps} {...rolePickerProps} />
            <IgnoreAccessRequests {...submenuProps} />
          </>
        )}
        {this.props.yourOperations.chat && (
          <RetentionPicker
            type="simple"
            containerStyle={{marginTop: globalMargins.small}}
            onSelect={this._onSelectRetentionPolicy}
            showSaveIndicator={false}
            teamID={this.props.teamID}
            entityType={this.props.isBigTeam ? 'big team' : 'small team'}
          />
        )}
        {this.props.yourOperations.chat && (
          <Kb.Box2 direction="vertical" style={styles.welcomeMessage} fullWidth={true}>
            <Kb.Box>
              <Kb.Text type="BodySmallSemibold">Welcome message</Kb.Text>
            </Kb.Box>
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Box2 direction="horizontal" style={styles.welcomeMessageContainer} />
              <Kb.Box2 direction="vertical" style={{position: 'relative'}} fullWidth={true}>
                {this.props.welcomeMessage ? (
                  <TeamJourney
                    actions={[]}
                    teamname={this.props.teamname}
                    conversationIDKey=""
                    image="icon-illustration-welcome-96"
                    onAuthorClick={() => {}}
                    onDismiss={() => {}}
                    textComponent={renderWelcomeMessage(this.props.welcomeMessage, false /* cannotWrite */)}
                    noDismiss={true}
                  />
                ) : (
                  <Kb.ProgressIndicator />
                )}
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" style={styles.button}>
          <Kb.Button
            label="Save"
            onClick={this.onSaveSettings}
            disabled={!this.state.publicitySettingsChanged}
            waiting={this.props.waitingForSavePublicity}
          />
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
  welcomeMessageContainer: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.grey,
    paddingLeft: Styles.globalMargins.xtiny,
  },
  grey: {color: globalColors.black_50},
  joinAs: platformStyles({
    isElectron: {
      paddingRight: globalMargins.xtiny,
    },
  }),
  main: {
    alignSelf: 'stretch',
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: globalMargins.small,
  },
  memberShowcase: {alignItems: 'flex-start', paddingRight: globalMargins.small},
  openTeam: {
    flexShrink: 1,
    paddingRight: globalMargins.small,
  },
  paddingRight: {paddingRight: globalMargins.xtiny},
  publicitySettings: {
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.small,
  },
  welcomeMessage: {
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.small,
  },
  shrink: {flex: 1},
  teamPadding: {paddingTop: globalMargins.small},
}))
