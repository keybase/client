// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Icon, Input, List, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {NativeImage} from '../../common-adapters/native-wrappers.native'
import {Linking, StyleSheet} from 'react-native'
import {isAndroid} from '../../constants/platform'
import type {MobileProps, ContactRowProps, ContactDisplayProps} from './index'
import {type TeamRoleType} from '../../constants/teams'

const settingsURL = 'app-settings:'
const openSettings = () => {
  Linking.canOpenURL(settingsURL).then(can => {
    if (can) {
      Linking.openURL(settingsURL)
    } else {
      console.warn('Invite contacts: Unable to open app settings')
    }
  })
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
        color: globalColors.red,
        fontSize: globalMargins.xlarge,
        marginBottom: globalMargins.large,
      }}
    />
    <Box>
      <Text type="Body" style={{marginBottom: globalMargins.small, textAlign: 'center'}}>
        We don't have permission to access your contacts!
      </Text>
      <Text type="Body" style={{marginBottom: globalMargins.small, textAlign: 'center'}}>
        To fix this, please open Settings > Keybase and check off 'Allow Keybase to access Contacts'.
      </Text>
      <Button type="Primary" label="Open settings" onClick={openSettings} />
    </Box>
  </Box>
)

const contactRow = (i: number, props: ContactRowProps) => {
  const source = typeof props.contact.thumbnailPath === 'string'
    ? {uri: 'file://' + props.contact.thumbnailPath}
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
          {!!hasThumbnail &&
            <NativeImage
              style={{width: 48, height: 48, borderRadius: 24, marginRight: 16}}
              source={source}
            />}
          {!hasThumbnail && <Avatar size={48} style={{marginRight: 16}} />}
          <Box>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySemibold">{props.contact.name}</Text>
            </Box>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySmall">
                {props.contact.email || props.contact.phoneNo}
              </Text>
            </Box>
          </Box>
        </Box>
        <Box>
          <Button
            type={props.selected ? 'Following' : 'Primary'}
            label={props.selected ? 'Invited!' : 'Invite'}
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

class InviteByEmail extends React.Component<MobileProps, State> {
  constructor(props: MobileProps) {
    super(props)
    this.state = {
      filter: '',
    }
  }

  _onSelectContact(contact: ContactDisplayProps) {
    if (this._isSelected(contact)) {
      this._removeInvitee(contact) // TODO: wire up to revoke invite RPC
    } else {
      this._addInvitee(contact)
    }
  }

  _isSelected(contact: ContactDisplayProps): boolean {
    return this.props.invitees.findIndex(rec => rec.contactID === contact.recordID) >= 0
  }

  _addInvitee(contact: ContactDisplayProps) {
    if (contact.email) {
      this.props.onInvite(contact.email)
    }
  }

  _removeInvitee(contact: ContactDisplayProps) {
    // const idx = this.props.invitees.findIndex(rec => rec.contactID === contact.recordID)
    // if (idx < 0) {
    //   console.warn('Warning: attempted to remove an invitee that was not in the list.')
    // } else {
    //   this.setState({
    //     invitees: this.state.invitees.filter(rec => rec.contactID !== contact.recordID),
    //   })
    // }
  }

  _trim(s: ?string): string {
    return (s && s.replace(/^[^a-z0-9@.]/i, '').toLowerCase()) || ''
  }

  render() {
    const contactRowProps = this.props.contacts.reduce((res, contact) => {
      const contactName = isAndroid ? contact.givenName : contact.givenName + ' ' + contact.familyName
      contact.emailAddresses.forEach(email => {
        const cData = {
          name: contactName,
          email: email.email,
          label: email.label,
          thumbnailPath: contact.thumbnailPath,
          recordID: contact.recordID + email.email,
        }
        res.push({
          id: contact.recordID + email.email,
          onClick: () => this._onSelectContact(cData),
          selected: this._isSelected(cData),
          contact: cData,
        })
      })
      contact.phoneNumbers.forEach(phoneNo => {
        const cData = {
          name: contactName,
          phoneNo: phoneNo.number,
          label: phoneNo.label,
          thumbnailPath: contact.thumbnailPath,
          recordID: contact.recordID + phoneNo.number,
        }
        res.push({
          id: contact.recordID + phoneNo.number,
          onClick: () => this._onSelectContact(cData),
          selected: this._isSelected(cData),
          contact: cData,
        })
      })
      return res
    }, [])
    const filteredContactRows = contactRowProps.filter(contact => {
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
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
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
              style={{width: '100%'}}
              errorStyle={{minHeight: 14}}
              inputStyle={{textAlign: 'left', paddingLeft: globalMargins.small, fontSize: 16}}
            />
          </Box>
          <ClickableBox
            onClick={() =>
              this.props.onOpenRolePicker(this.props.role, (selectedRole: TeamRoleType) =>
                this.props.onRoleChange(selectedRole)
              )}
            style={{
              ...globalStyles.flexBoxColumn,
              alignItems: 'center',
              justifyContent: 'center',
              padding: globalMargins.small,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: globalColors.black_05,
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
