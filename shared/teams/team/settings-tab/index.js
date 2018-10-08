// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import type {RetentionPolicy} from '../../../constants/types/retention-policy'
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
  savePublicity: (Types.PublicitySettings, boolean, RetentionPolicy) => void,
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
  newRetentionPolicy: RetentionPolicy,
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
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', paddingRight: globalMargins.small}}>
    <Checkbox
      checked={props.newPublicityMember}
      disabled={!props.yourOperations.setMemberShowcase}
      labelComponent={
        <Box style={{...globalStyles.flexBoxColumn}}>
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
      }
      onCheck={props.setBoolSettings('newPublicityMember')}
      style={{paddingRight: globalMargins.xtiny}}
    />
  </Box>
)

const PublicityAnyMember = (props: SettingProps) =>
  props.yourOperations.setPublicityAny && (
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
  )

const teamsLink = 'keybase.io/popular-teams'

const PublicityTeam = (props: SettingProps) =>
  props.yourOperations.setTeamShowcase && (
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
  )

const OpenTeam = (props: SettingProps) => {
  if (!props.yourOperations.changeOpenTeam) {
    return null
  }

  const _onSetOpenTeamRole = props.onSetOpenTeamRole

  const onSetOpenTeamRole = _onSetOpenTeamRole
    ? (e: SyntheticEvent<>) => {
        e.stopPropagation()
        _onSetOpenTeamRole()
      }
    : undefined

  return (
    <Box style={stylesPublicitySettingsBox}>
      <Checkbox
        checked={props.newOpenTeam}
        labelComponent={
          <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1, paddingRight: globalMargins.small}}>
            <Text type="Body">Make this an open team</Text>
            <Text type="BodySmall">
              Anyone will be able to join immediately. Users will join as{' '}
              <Text
                type={props.newOpenTeam ? 'BodySmallPrimaryLink' : 'BodySmall'}
                onClick={props.newOpenTeam ? onSetOpenTeamRole : undefined}
              >
                {pluralize(props.newOpenTeamRole)}
              </Text>
              .
            </Text>
          </Box>
        }
        onCheck={props.setBoolSettings('newOpenTeam')}
      />
    </Box>
  )
}

const IgnoreAccessRequests = (props: SettingProps) =>
  !props.newOpenTeam &&
  props.yourOperations.changeTarsDisabled && (
    <Box style={stylesPublicitySettingsBox}>
      <Checkbox
        checked={props.newIgnoreAccessRequests}
        labelComponent={
          <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
            <Text type="Body">Ignore requests to join this team</Text>
            <Text type="BodySmall">Admins won't be bothered by hordes of fans.</Text>
          </Box>
        }
        onCheck={props.setBoolSettings('newIgnoreAccessRequests')}
      />
    </Box>
  )

export class Settings extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = this._getNewStateObject(props)
  }

  _getNewStateObject = (p: Props) => {
    return {
      newIgnoreAccessRequests: p.ignoreAccessRequests,
      newOpenTeam: p.openTeam,
      newOpenTeamRole: p.openTeamRole,
      newPublicityAnyMember: p.publicityAnyMember,
      newPublicityMember: p.publicityMember,
      newPublicityTeam: p.publicityTeam,
      newRetentionPolicy: retentionPolicies.policyRetain, // placeholder
      publicitySettingsChanged: false,
      retentionPolicyChanged: false,
      retentionPolicyDecreased: false,
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
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
    newRetentionPolicy: RetentionPolicy,
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
            <Box style={{...globalStyles.flexBoxRow, paddingTop: globalMargins.small}}>
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
            ...globalStyles.flexBoxRow,
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
  alignItems: 'flex-start',
  paddingTop: globalMargins.small,
  paddingRight: globalMargins.small,
}
