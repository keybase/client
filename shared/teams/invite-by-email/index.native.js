// @flow
import * as React from 'react'
import {
  Box,
  Button,
  ClickableBox,
  Dropdown,
  Icon,
  List,
  Input,
  PopupDialog,
  Text,
} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import capitalize from 'lodash/capitalize'
import * as Contacts from 'react-native-contacts'
import {isAndroid} from '../../constants/platform'

import {teamRoleTypes, type TeamRoleType} from '../../constants/teams'

const AccessDenied = () => (
  <Text type="BodySemibold">
    We don't have permission to access your contacts! To fix this, please open Settings > Keybase and check off 'Allow Keybase to access Contacts'.
  </Text>
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

const contactRow = (i: number, props: ContactProps) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Text type="BodySemibold">{props.givenName} {props.familyName}</Text>
        {props.emailAddresses.length === 0 &&
          <Icon
            type="iconfont-open-browser"
            style={{color: globalColors.black_20, fontSize: 16, marginLeft: globalMargins.small}}
          />}
      </Box>
    </Box>
  )
}

type Props = {
  invitees: string,
  name: string,
  onClose: () => void,
  onInvite: () => void,
  onInviteesChange: (invitees: string) => void,
  onOpenRolePicker: (currentSelectedRole: TeamRoleType, selectedRoleCallback: (TeamRoleType) => void) => void,
  onRoleChange: (role: TeamRoleType) => void,
  role: TeamRoleType,
}

type State = {
  invitees: Array<string>,
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

  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn, margin: globalMargins.small, flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text type="BodySemibold">
            Select contacts to invite to {this.props.name}
          </Text>
        </Box>
        {!this.state.hasPermission && <AccessDenied />}
        {this.state.hasPermission &&
          <List
            keyProperty="recordID"
            items={this.state.contacts}
            fixedHeight={48}
            renderItem={contactRow}
            style={{alignSelf: 'stretch'}}
          />}
      </Box>
    )
  }
}

export default InviteByEmail
