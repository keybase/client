// @flow
import * as React from 'react'
import {Box, Button, Icon, Input, List, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {NativeImage} from '../../common-adapters/native-wrappers.native'
import * as Contacts from 'react-native-contacts'
import {isAndroid} from '../../constants/platform'
import {type Props} from './index'

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
      <Text type="Body" style={{marginBottom: globalMargins.small}}>
        We don't have permission to access your contacts!
      </Text>
      <Text type="Body">
        To fix this, please open Settings > Keybase and check off 'Allow Keybase to access Contacts'.
      </Text>
    </Box>
  </Box>
)

// Note: 'on Android the entire display name is passed in the givenName field. middleName and familyName will be empty strings.'
type ContactProps = {
  recordID: string,
  company: string,
  emailAddresses: Array<{label: string, email: string}>,
  familyName: string,
  givenName: string,
  middleName: string,
  phoneNumbers: Array<{label: string, number: string}>,
  hasThumbnail: boolean,
  thumbnailPath: string,
  // Postal addresses, etc. - unused
}

type ContactDisplayProps = {
  name: string,
  email?: string,
  phoneNo?: string,
  thumbnailPath?: string,
  label: string,
  recordID: string,
}

type ContactRowProps = {
  contact: ContactDisplayProps,
  id: string,
  onClick: () => void,
  selected: boolean,
}

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
        height: 48,
        width: '100%',
        padding: globalMargins.small,
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
          {!!hasThumbnail &&
            <NativeImage style={{width: 32, height: 32, borderRadius: 16, marginRight: 8}} source={source} />}
          {!hasThumbnail && <Box style={{width: 40}} />}
          <Box>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="Body">{props.contact.name}</Text>
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
            type={props.selected ? 'Following' : 'Follow'}
            label={props.selected ? 'Invited!' : 'Invite'}
            small={true}
            onClick={props.onClick}
            style={{width: 'auto', paddingLeft: globalMargins.medium, paddingRight: globalMargins.medium}}
          />
        </Box>
      </Box>
    </Box>
  )
}

type State = {
  invitees: Array<{contactID: string, address?: string}>,
  loading: boolean,
  filter: string,
  hasPermission: boolean,
  contacts: Array<ContactProps>,
}

class InviteByEmail extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      invitees: [],
      loading: true,
      filter: '',
      hasPermission: false,
      contacts: [],
    }
  }

  componentWillMount() {
    if (isAndroid) {
      Contacts.requestPermission((_, granted) => {
        this.setState({hasPermission: false})
        if (granted) {
          Contacts.getAll((err, contacts) => {
            if (err) {
              this.setState({hasPermission: false})
            } else {
              this.setState({hasPermission: true, contacts})
            }
          })
        }
      })
    } else {
      Contacts.getAll((err, contacts) => {
        if (err) {
          this.setState({hasPermission: false})
        } else {
          this.setState({hasPermission: true, contacts})
          console.log('CONTACTS: ', contacts)
        }
      })
    }
  }

  onSelectContact(contact: ContactDisplayProps) {
    console.log('clicked: ', contact)

    if (this.isSelected(contact)) {
      this._removeInvitee(contact)
    } else {
      this._addInvitee(contact)
    }
  }

  isSelected(contact: ContactDisplayProps): boolean {
    return this.state.invitees.findIndex(rec => rec.contactID === contact.recordID) >= 0
  }

  _addInvitee(contact: ContactDisplayProps) {
    if (contact.email) {
      this.setState({
        invitees: [...this.state.invitees, {contactID: contact.recordID, address: contact.email}],
      })
    } else {
      this.setState({
        invitees: [...this.state.invitees, {contactID: contact.recordID}],
      })
    }
  }

  _removeInvitee(contact: ContactDisplayProps) {
    const idx = this.state.invitees.findIndex(rec => rec.contactID === contact.recordID)
    if (idx < 0) {
      console.warn('Warning: attempted to remove an invitee that was not in the list.')
    } else {
      this.setState({
        invitees: this.state.invitees.filter(rec => rec.contactID !== contact.recordID),
      })
    }
  }

  render() {
    const contactRowProps = this.state.contacts.reduce((res, contact) => {
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
          onClick: () => this.onSelectContact(cData),
          selected: this.isSelected(cData),
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
          onClick: () => this.onSelectContact(cData),
          selected: this.isSelected(cData),
          contact: cData,
        })
      })
      return res
    }, [])
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {!this.state.hasPermission && <AccessDenied />}
        {this.state.hasPermission &&
          <Box style={{...globalStyles.flexBoxRow}}>
            <Input
              keyboardType="email-address"
              value={this.state.filter}
              hintText="Email or phone number"
              hideUnderline={true}
              style={{width: '100%'}}
              inputStyle={{textAlign: 'left', paddingLeft: globalMargins.small}}
            />
          </Box>}
        {this.state.hasPermission &&
          <List
            keyProperty="id"
            items={contactRowProps}
            fixedHeight={48}
            renderItem={contactRow}
            style={{alignSelf: 'stretch'}}
          />}
      </Box>
    )
  }
}

export default InviteByEmail
