// @flow
import * as React from 'react'
import {
  Avatar,
  Box,
  Box2,
  Button,
  ButtonBar,
  ClickableBox,
  Icon,
  Input,
  List,
  Text,
  NativeImage,
} from '../../common-adapters/mobile.native'
import {globalStyles, globalMargins, globalColors, hairlineWidth} from '../../styles'
import type {MobileProps, ContactRowProps} from './index'
import {type TeamRoleType} from '../../constants/types/teams'

const AccessDenied = ({openAppSettings}) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: globalMargins.small,
    }}
  >
    <Icon
      type="iconfont-close"
      style={{
        marginBottom: globalMargins.large,
      }}
      color={globalColors.red}
      fontSize={globalMargins.xlarge}
    />
    <Box>
      <Text center={true} type="Body" style={{marginBottom: globalMargins.small}}>
        We don't have permission to access your contacts!
      </Text>
      <Text center={true} type="Body" style={{marginBottom: globalMargins.small}}>
        To fix this, please open Settings > Keybase and check off 'Allow Keybase to access Contacts'.
      </Text>
      <ButtonBar>
        <Button type="Primary" label="Open settings" onClick={openAppSettings} />
      </ButtonBar>
    </Box>
  </Box>
)

const contactRow = (i: number, props: ContactRowProps) => {
  const source =
    typeof props.contact.thumbnailPath === 'string'
      ? {uri: `file://${props.contact.thumbnailPath}`}
      : props.contact.thumbnailPath
  const hasThumbnail = props.contact.thumbnailPath && props.contact.thumbnailPath.length > 0
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 56,
        padding: globalMargins.small,
        width: '100%',
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
          {!!hasThumbnail && (
            <NativeImage style={{borderRadius: 24, height: 48, marginRight: 16, width: 48}} source={source} />
          )}
          {!hasThumbnail && <Avatar size={48} style={{marginRight: 16}} />}
          <Box>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySemibold">{props.contact.name}</Text>
            </Box>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySmall">{props.contact.email || props.contact.phoneNo}</Text>
            </Box>
          </Box>
        </Box>
        <Box>
          <Button
            type={props.selected ? 'PrimaryGreenActive' : 'Primary'}
            label={props.selected ? 'Invited!' : 'Invite'}
            waiting={props.loading}
            small={true}
            onClick={props.onClick}
            style={{paddingLeft: globalMargins.small, paddingRight: globalMargins.small, width: 100}}
          />
        </Box>
      </Box>
    </Box>
  )
}

type State = {
  filter: string,
}

// Container handles all the props, this just handles filtering
class InviteByEmailMobile extends React.Component<MobileProps, State> {
  state = {
    filter: '',
  }

  _trim(s: ?string): string {
    return (s && s.replace(/^[^a-z0-9@.]/i, '').toLowerCase()) || ''
  }

  componentWillUnmount() {
    this.props.onClearError()
  }

  render() {
    // Filter before adding props to avoid a long map fcn
    const filteredContactRows = this.props.contactRowProps.filter(contact => {
      let {filter} = this.state
      filter = this._trim(filter)
      if (filter.length === 0) {
        return true
      }
      return (
        this._trim(contact.contact.name).includes(filter) ||
        this._trim(contact.contact.email).includes(filter) ||
        this._trim(contact.contact.phoneNo).includes(filter)
      )
    })
    let contents
    if (this.props.hasPermission) {
      contents = (
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, paddingBottom: globalMargins.xtiny}}>
          {!!this.props.errorMessage && (
            <Box2
              direction="horizontal"
              style={{
                alignItems: 'center',
                backgroundColor: globalColors.red,
                justifyContent: 'center',
                padding: globalMargins.tiny,
              }}
              fullWidth={true}
            >
              <Text center={true} type="BodySemibold" backgroundMode="HighRisk">
                {this.props.errorMessage}
              </Text>
            </Box2>
          )}
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              borderBottomColor: globalColors.black_10,
              borderBottomWidth: hairlineWidth,
            }}
          >
            <Input
              keyboardType="email-address"
              value={this.state.filter}
              onChangeText={filter => this.setState({filter})}
              hintText="Search"
              hideUnderline={true}
              small={true}
              style={{width: '100%'}}
              errorStyle={{minHeight: 14}}
              inputStyle={{
                fontSize: 16,
                margin: globalMargins.small,
                textAlign: 'left',
              }}
            />
          </Box>
          <ClickableBox
            onClick={() =>
              this.props.onOpenRolePicker(this.props.role, (selectedRole: TeamRoleType) =>
                this.props.onRoleChange(selectedRole)
              )
            }
            style={{
              ...globalStyles.flexBoxColumn,
              alignItems: 'center',
              borderBottomColor: globalColors.black_10,
              borderBottomWidth: hairlineWidth,
              justifyContent: 'center',
              marginBottom: globalMargins.xtiny,
              padding: globalMargins.small,
            }}
          >
            <Text center={true} type="BodySmall" >
              Users will be invited to {this.props.name} as
              <Text type="BodySmallPrimaryLink">{' ' + this.props.role + 's'}</Text>.
            </Text>
          </ClickableBox>
          <List
            keyProperty="id"
            items={filteredContactRows}
            fixedHeight={56}
            renderItem={contactRow}
            style={{alignSelf: 'stretch'}}
          />
        </Box>
      )
    } else {
      contents = (
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          <AccessDenied openAppSettings={this.props.openAppSettings} />
        </Box>
      )
    }
    return contents
  }
}

export {InviteByEmailMobile}
