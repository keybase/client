// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {retentionPolicies} from '../../../constants/teams'
import {Box, Button, Checkbox, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {pluralize} from '../../../util/string'
import RetentionPicker from './retention/container'

// initial settings (except retention policy)
type Props = {|
  isBigTeam: boolean,
  ignoreAccessRequests: boolean,
  publicityAnyMember: boolean,
  publicityMember: boolean,
  publicityTeam: boolean,
  openTeam: boolean,
  openTeamRole: Types.TeamRoleType,
  savePublicity: (Types.PublicitySettings, boolean, Types.RetentionPolicy) => void,
  setOpenTeamRole: (
    newOpenTeamRole: Types.TeamRoleType,
    setNewOpenTeamRole: (Types.TeamRoleType) => void
  ) => void,
  teamname: Types.Teamname,
  yourOperations: Types.TeamOperations,
  waitingForSavePublicity: boolean,
|}

type NewSettings = {|
  newIgnoreAccessRequests: boolean,
  newPublicityAnyMember: boolean,
  newPublicityMember: boolean,
  newPublicityTeam: boolean,
  newOpenTeam: boolean,
  newOpenTeamRole: Types.TeamRoleType,
  newRetentionPolicy: Types.RetentionPolicy,
|}

// new settings
type State = {|
  ...NewSettings,
  publicitySettingsChanged: boolean,
  retentionPolicyChanged: boolean,
  retentionPolicyDecreased: boolean,
|}

type SettingProps = {|
  ...Props,
  ...State,
  setBoolSettings: (key: any) => (newSetting: boolean) => void,
  onSetOpenTeamRole?: () => void,
|}

const SetMemberShowcase = (props: SettingProps) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
    }}
  >
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Checkbox
        checked={props.newPublicityMember}
        disabled={!props.yourOperations.setMemberShowcase}
        label=""
        onCheck={props.setBoolSettings('newPublicityMember')}
        style={{paddingRight: globalMargins.xtiny}}
      />
    </Box>
    <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
      <Text
        style={{
          color: props.yourOperations.setMemberShowcase ? globalColors.black_75 : globalColors.grey,
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
  </Box>
)

const PublicityAnyMember = (props: SettingProps) =>
  props.yourOperations.setPublicityAny && (
    <Box style={stylesSettingsTabRow}>
      <Box style={stylesPublicitySettingsBox}>
        <Checkbox
          checked={props.newPublicityAnyMember}
          label=""
          onCheck={props.setBoolSettings('newPublicityAnyMember')}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
        <Text type="Body">Allow non-admin members to publish the team on their profile</Text>
        <Text type="BodySmall">Team descriptions and number of members will be public.</Text>
      </Box>
    </Box>
  )

const teamsLink = 'keybase.io/popular-teams'

const PublicityTeam = (props: SettingProps) =>
  props.yourOperations.setTeamShowcase && (
    <Box style={stylesSettingsTabRow}>
      <Box style={stylesPublicitySettingsBox}>
        <Checkbox
          checked={props.newPublicityTeam}
          label=""
          onCheck={props.setBoolSettings('newPublicityTeam')}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
        <Text type="Body">
          Publicize this team on{' '}
          <Text type="BodyPrimaryLink" onClickURL={`https://${teamsLink}`}>
            {teamsLink}
          </Text>
        </Text>
        <Text type="BodySmall">Team descriptions and number of members will be public.</Text>
      </Box>
    </Box>
  )

const OpenTeam = (props: SettingProps) =>
  props.yourOperations.changeOpenTeam && (
    <Box style={stylesSettingsTabRow}>
      <Box style={stylesPublicitySettingsBox}>
        <Checkbox checked={props.newOpenTeam} label="" onCheck={props.setBoolSettings('newOpenTeam')} />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1, paddingRight: globalMargins.small}}>
        <Text type="Body">Make this an open team</Text>
        <Text type="BodySmall">
          Anyone will be able to join immediately. Users will join as{' '}
          <Text
            type={props.newOpenTeam ? 'BodySmallPrimaryLink' : 'BodySmall'}
            onClick={props.newOpenTeam ? props.onSetOpenTeamRole : undefined}
          >
            {pluralize(props.newOpenTeamRole)}
          </Text>
          .
        </Text>
      </Box>
    </Box>
  )

const IgnoreAccessRequests = (props: SettingProps) =>
  !props.newOpenTeam &&
  props.yourOperations.changeTarsDisabled && (
    <Box style={stylesSettingsTabRow}>
      <Box style={stylesPublicitySettingsBox}>
        <Checkbox
          checked={props.newIgnoreAccessRequests}
          label=""
          onCheck={props.setBoolSettings('newIgnoreAccessRequests')}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
        <Text type="Body">Ignore requests to join this team</Text>
        <Text type="BodySmall">Admins won't be bothered by hordes of fans.</Text>
      </Box>
    </Box>
  )

export class Settings extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      // This isn't strictly necessary but flow doesn't understand getDerivedStateFromProps will run
      newIgnoreAccessRequests: this.props.ignoreAccessRequests,
      newPublicityAnyMember: this.props.publicityAnyMember,
      newPublicityMember: this.props.publicityMember,
      newPublicityTeam: this.props.publicityTeam,
      newOpenTeam: this.props.openTeam,
      newOpenTeamRole: this.props.openTeamRole,
      newRetentionPolicy: retentionPolicies.policyRetain, // placeholder
      publicitySettingsChanged: false,
      retentionPolicyChanged: false,
      retentionPolicyDecreased: false,
    }
  }

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    // We just got new settings for this team, reset any user selections
    // to reflect the actual settings.
    return {
      newIgnoreAccessRequests: nextProps.ignoreAccessRequests,
      newOpenTeam: nextProps.openTeam,
      newOpenTeamRole: nextProps.openTeamRole,
      newPublicityAnyMember: nextProps.publicityAnyMember,
      newPublicityMember: nextProps.publicityMember,
      newPublicityTeam: nextProps.publicityTeam,
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    this.setState((prevState: State, props: Props) => {
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

  setBoolSettings = (key: any) => (newSetting: boolean) => {
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

  onSetOpenTeamRole = () => {
    this.props.setOpenTeamRole(this.state.newOpenTeamRole, newOpenTeamRole =>
      this.setState({newOpenTeamRole})
    )
  }

  _onSelectRetentionPolicy = (
    newRetentionPolicy: Types.RetentionPolicy,
    retentionPolicyChanged: boolean,
    retentionPolicyDecreased: boolean
  ) => {
    this.setState({newRetentionPolicy, retentionPolicyChanged, retentionPolicyDecreased})
  }

  render() {
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
            <Box style={stylesSettingsTabRow}>
              <Text type="Header">Team</Text>
            </Box>
            <PublicityAnyMember {...this.props} {...this.state} setBoolSettings={this.setBoolSettings} />
            <PublicityTeam {...this.props} {...this.state} setBoolSettings={this.setBoolSettings} />
            <OpenTeam
              {...this.props}
              {...this.state}
              setBoolSettings={this.setBoolSettings}
              onSetOpenTeamRole={this.onSetOpenTeamRole}
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
            ...stylesSettingsTabRow,
            justifyContent: 'center',
            paddingBottom: isMobile ? globalMargins.tiny : globalMargins.small,
            paddingTop: isMobile ? globalMargins.tiny : globalMargins.small,
          }}
        >
          <Button
            type="Primary"
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
  alignItems: 'center',
  paddingRight: globalMargins.small,
}

const stylesSettingsTabRow = {
  ...globalStyles.flexBoxRow,
  paddingTop: globalMargins.small,
}
