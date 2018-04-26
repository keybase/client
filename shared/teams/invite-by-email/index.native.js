// @flow
import logger from '../../logger'
import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  ButtonBar,
  ClickableBox,
  Icon,
  Input,
  List,
  Text,
  NativeImage,
} from '../../common-adapters/index.native'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Linking, StyleSheet, NativeModules} from 'react-native'
import type {MobileProps, ContactRowProps} from './index'
import {type TeamRoleType} from '../../constants/types/teams'
import {isAndroid} from '../../constants/platform'

const settingsURL = 'app-settings:'
const openSettings = () => {
  if (isAndroid) {
    NativeModules.NativeSettings.open()
  } else {
    Linking.canOpenURL(settingsURL).then(can => {
      if (can) {
        Linking.openURL(settingsURL)
      } else {
        logger.warn('Invite contacts: Unable to open app settings')
      }
    })
  }
}
const AccessDenied = () => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      padding: globalMargins.small,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
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
      <Text type="Body" style={{marginBottom: globalMargins.small, textAlign: 'center'}}>
        We don't have permission to access your contacts!
      </Text>
      <Text type="Body" style={{marginBottom: globalMargins.small, textAlign: 'center'}}>
        To fix this, please open Settings > Keybase and check off 'Allow Keybase to access Contacts'.
      </Text>
      <ButtonBar>
        <Button type="Primary" label="Open settings" onClick={openSettings} />
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
        width: '100%',
        padding: globalMargins.small,
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
          {!!hasThumbnail && (
            <NativeImage style={{width: 48, height: 48, borderRadius: 24, marginRight: 16}} source={source} />
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
            style={{width: 100, paddingLeft: globalMargins.small, paddingRight: globalMargins.small}}
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
class InviteByEmail extends React.Component<MobileProps, State> {
  state = {
    filter: '',
  }

  _trim(s: ?string): string {
    return (s && s.replace(/^[^a-z0-9@.]/i, '').toLowerCase()) || ''
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
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: globalColors.black_05,
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
                textAlign: 'left',
                margin: globalMargins.small,
                fontSize: 16,
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
              justifyContent: 'center',
              padding: globalMargins.small,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: globalColors.black_05,
              marginBottom: globalMargins.xtiny,
            }}
          >
            <Text type="BodySmall" style={{textAlign: 'center'}}>
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
          <AccessDenied />
        </Box>
      )
    }
    return contents
  }
}

export default InviteByEmail
