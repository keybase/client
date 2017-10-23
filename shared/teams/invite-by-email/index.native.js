// @flow
import * as React from 'react'
import {Box, ClickableBox, Icon, List, Text} from '../../common-adapters'
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

type ContactRowProps = {
  contact: ContactProps,
  id: string,
  onClick: () => void,
  selected: boolean,
}

const contactRow = (i: number, props: ContactRowProps) => {
  const contactName = isAndroid
    ? props.contact.givenName
    : props.contact.givenName + ' ' + props.contact.familyName
  const source = typeof props.contact.thumbnailPath === 'string'
    ? {uri: 'file://' + props.contact.thumbnailPath}
    : props.contact.thumbnailPath
  return (
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 48,
        width: '100%',
        padding: globalMargins.small,
      }}
      onClick={props.onClick}
      key={props.contact.recordID}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
          {props.contact.hasThumbnail &&
            <NativeImage style={{width: 32, height: 32, borderRadius: 16, marginRight: 8}} source={source} />}
          {!props.contact.hasThumbnail && <Box style={{width: 40}} />}
          <Text type="Body">{contactName}</Text>
          {props.contact.emailAddresses.length === 0 &&
            <Icon
              type="iconfont-open-browser"
              style={{color: globalColors.black_20, fontSize: 16, marginLeft: globalMargins.small}}
            />}
        </Box>
        {props.selected &&
          <Icon
            type="iconfont-check"
            style={{color: globalColors.blue, fontSize: 24, marginRight: globalMargins.medium}}
          />}
      </Box>
    </ClickableBox>
  )
}

// We need inviteeIDs separate from inviteeEmails to keep track of selected contacts that don't have an email address
type State = {
  invitees: Array<{contactID: string, address?: string}>,
  loading: boolean,
  hasPermission: boolean,
  contacts: Array<any>,
}

class InviteByEmail extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      invitees: [],
      loading: true,
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

  onSelectContact(contact: ContactProps) {
    console.log('clicked: ', contact)

    if (this.isSelected(contact)) {
      this._removeInvitee(contact)
    } else {
      this._addInvitee(contact)
    }
  }

  isSelected(contact: ContactProps): boolean {
    return this.state.invitees.findIndex(rec => rec.contactID === contact.recordID) >= 0
  }

  _addInvitee(contact: ContactProps) {
    if (contact.emailAddresses.length > 0) {
      this.setState({
        invitees: [
          ...this.state.invitees,
          {contactID: contact.recordID, address: contact.emailAddresses[0].email},
        ],
      })
    } else {
      this.setState({
        invitees: [...this.state.invitees, {contactID: contact.recordID}],
      })
    }
  }

  _removeInvitee(contact: ContactProps) {
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
    const contactRowProps = this.state.contacts.map(contact => ({
      contact,
      id: contact.recordID,
      onClick: () => this.onSelectContact(contact),
      selected: this.isSelected(contact),
    }))
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {!this.state.hasPermission && <AccessDenied />}
        {this.state.hasPermission &&
          <Box style={{...globalStyles.flexBoxRow, padding: globalMargins.small}}>
            <Text type="Body">
              Select contacts to invite to {this.props.name}
            </Text>
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
