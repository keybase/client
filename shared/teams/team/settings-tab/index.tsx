import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {RetentionPolicy} from '../../../constants/types/retention-policy'
import {Box2, Box, Button, Checkbox, Text} from '../../../common-adapters'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {globalColors, globalMargins, globalStyles, styleSheetCreate, platformStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {FloatingRolePicker} from '../../role-picker'
import {pluralize} from '../../../util/string'
import RetentionPicker from './retention/container'

type Props = {
  isBigTeam: boolean
  ignoreAccessRequests: boolean
  publicityAnyMember: boolean
  publicityMember: boolean
  publicityTeam: boolean
  openTeam: boolean
  openTeamRole: Types.TeamRoleType
  savePublicity: (arg0: Types.PublicitySettings, arg1: boolean, arg2: RetentionPolicy | null) => void
  teamname: Types.Teamname
  yourOperations: Types.TeamOperations
  waitingForSavePublicity: boolean
}

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onOpenRolePicker: () => void
  onSelectRole: (role: Types.TeamRoleType) => void
  newOpenTeamRole: Types.TeamRoleType
  disabledReasonsForRolePicker: {[K in Types.TeamRoleType]: string}
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

type SettingProps = {
  // TODO stronger type here
  setBoolSettings: (key: any) => (newSetting: boolean) => void
} & Props &
  State

const SetMemberShowcase = (props: SettingProps) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', paddingRight: globalMargins.small}}>
    <Checkbox
      checked={props.newPublicityMember}
      disabled={!props.yourOperations.setMemberShowcase}
      labelComponent={
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Text
            style={{
              color: props.yourOperations.setMemberShowcase ? globalColors.black : globalColors.black_50,
            }}
            type="Body"
          >
            Publish team on your own profile
          </Text>
          <Text type="BodySmall">
            {props.yourOperations.setMemberShowcase
              ? 'Your profile will mention this team. Team description and number of members will be public.'
              : props.yourOperations.joinTeam
              ? 'You must join this team to publish it on your profile.'
              : "Admins aren't allowing members to publish this team on their profile."}
          </Text>
        </Box>
      }
      onCheck={props.setBoolSettings('newPublicityMember')}
      style={{paddingRight: globalMargins.xtiny}}
    />
  </Box>
)

const PublicityAnyMember = (props: SettingProps) =>
  props.yourOperations.setPublicityAny ? (
    <Box style={stylesPublicitySettingsBox}>
      <Checkbox
        checked={props.newPublicityAnyMember}
        labelComponent={
          <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
            <Text type="Body">Allow non-admin members to publish the team on their profile</Text>
            <Text type="BodySmall">Team descriptions and number of members will be public.</Text>
          </Box>
        }
        onCheck={props.setBoolSettings('newPublicityAnyMember')}
      />
    </Box>
  ) : null

const teamsLink = 'keybase.io/popular-teams'

const PublicityTeam = (props: SettingProps) =>
  props.yourOperations.setTeamShowcase ? (
    <Box style={stylesPublicitySettingsBox}>
      <Checkbox
        checked={props.newPublicityTeam}
        labelComponent={
          <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
            <Text type="Body">
              Publicize this team on{' '}
              <Text type="BodyPrimaryLink" onClickURL={`https://${teamsLink}`}>
                {teamsLink}
              </Text>
            </Text>
            <Text type="BodySmall">Team descriptions and number of members will be public.</Text>
          </Box>
        }
        onCheck={props.setBoolSettings('newPublicityTeam')}
      />
    </Box>
  ) : null

const OpenTeam = (props: SettingProps & RolePickerProps) => {
  if (!props.yourOperations.changeOpenTeam) {
    return null
  }

  // <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1, paddingRight: globalMargins.small}}>
  return (
    <Box style={stylesPublicitySettingsBox}>
      <Checkbox
        checked={props.newOpenTeam}
        labelComponent={
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              flexShrink: 1,
              paddingRight: globalMargins.small,
              whiteSpace: 'pre',
            }}
          >
            <Text type="Body">Make this an open team</Text>
            <Box2
              direction={isMobile ? 'vertical' : 'horizontal'}
              alignItems={isMobile ? 'flex-start' : 'center'}
              alignSelf="flex-start"
            >
              <Text style={styles.joinAs} type="BodySmall">
                Anyone will be able to join immediately. Users will join as{' '}
              </Text>
              <FloatingRolePicker
                confirmLabel={`Let in as ${pluralize(props.newOpenTeamRole)}`}
                selectedRole={props.newOpenTeamRole}
                onSelectRole={props.onSelectRole}
                floatingContainerStyle={styles.floatingRolePicker}
                onConfirm={props.onConfirmRolePicker}
                onCancel={props.onCancelRolePicker}
                position={'bottom center'}
                open={props.isRolePickerOpen}
                disabledRoles={props.disabledReasonsForRolePicker}
              >
                <InlineDropdown
                  label={pluralize(props.newOpenTeamRole)}
                  onPress={props.newOpenTeam ? props.onOpenRolePicker : () => {}}
                  type="BodySmall"
                />
              </FloatingRolePicker>
            </Box2>
          </Box>
        }
        onCheck={props.isRolePickerOpen ? null : props.setBoolSettings('newOpenTeam')}
      />
    </Box>
  )
}

const IgnoreAccessRequests = (props: SettingProps) =>
  !props.newOpenTeam && props.yourOperations.changeTarsDisabled ? (
    <Box style={stylesPublicitySettingsBox}>
      <Checkbox
        checked={props.newIgnoreAccessRequests}
        labelComponent={
          <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
            <Text type="Body">Don't allow requests to join this team</Text>
            <Text type="BodySmall">Requests to join this team will be silently ignored by all admins.</Text>
          </Box>
        }
        onCheck={props.setBoolSettings('newIgnoreAccessRequests')}
      />
    </Box>
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
      const publicitySettingsChanged = !(
        prevState.newIgnoreAccessRequests === this.props.ignoreAccessRequests &&
        prevState.newOpenTeam === this.props.openTeam &&
        prevState.newOpenTeamRole === this.props.openTeamRole &&
        prevState.newPublicityAnyMember === this.props.publicityAnyMember &&
        prevState.newPublicityMember === this.props.publicityMember &&
        prevState.newPublicityTeam === this.props.publicityTeam &&
        !prevState.retentionPolicyChanged
      )
      return publicitySettingsChanged !== prevState.publicitySettingsChanged
        ? {publicitySettingsChanged}
        : null
    })
  }

  // TODO just use real keys/setState and not this abstraction
  setBoolSettings = (key: any) => (newSetting: boolean): void => {
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
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignSelf: 'stretch',
          flexBasis: 0,
          flexGrow: 1,
          padding: globalMargins.medium,
        }}
      >
        <SetMemberShowcase {...this.props} {...this.state} setBoolSettings={this.setBoolSettings} />
        {(this.props.yourOperations.changeOpenTeam ||
          this.props.yourOperations.setTeamShowcase ||
          this.props.yourOperations.setPublicityAny) && (
          <React.Fragment>
            <Box style={{...globalStyles.flexBoxRow, paddingTop: globalMargins.small}}>
              <Text type="Header">Team</Text>
            </Box>
            <PublicityAnyMember {...this.props} {...this.state} setBoolSettings={this.setBoolSettings} />
            <PublicityTeam {...this.props} {...this.state} setBoolSettings={this.setBoolSettings} />
            <OpenTeam
              {...this.props}
              {...this.state}
              {...rolePickerProps}
              setBoolSettings={this.setBoolSettings}
            />
            <IgnoreAccessRequests {...this.props} {...this.state} setBoolSettings={this.setBoolSettings} />
          </React.Fragment>
        )}
        {this.props.yourOperations.chat && (
          <RetentionPicker
            type="simple"
            containerStyle={{marginTop: globalMargins.small}}
            onSelect={this._onSelectRetentionPolicy}
            showSaveIndicator={false}
            teamname={this.props.teamname}
            entityType={this.props.isBigTeam ? 'big team' : 'small team'}
          />
        )}
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            justifyContent: 'center',
            paddingBottom: isMobile ? globalMargins.tiny : globalMargins.small,
            paddingTop: isMobile ? globalMargins.tiny : globalMargins.small,
          }}
        >
          <Button
            label="Save"
            onClick={this.onSaveSettings}
            disabled={!this.state.publicitySettingsChanged}
            waiting={this.props.waitingForSavePublicity}
          />
        </Box>
      </Box>
    )
  }
}

const stylesPublicitySettingsBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  paddingRight: globalMargins.small,
  paddingTop: globalMargins.small,
}

const styles = styleSheetCreate({
  floatingRolePicker: platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  joinAs: platformStyles({
    isElectron: {
      paddingRight: 2,
    },
  }),
})
