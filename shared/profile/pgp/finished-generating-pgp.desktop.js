// @flow
import React, {Component} from 'react'
import {StandardScreen, Box, Text, Button, Icon, Checkbox} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles/style-guide'
import type {Props} from './finished-generating-pgp'

type State = {
  shouldStoreKeyOnServer: boolean,
}

class FinishedGeneratedPgp extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      shouldStoreKeyOnServer: true,
    }
  }

  _onCheckToggle (shouldStoreKeyOnServer: boolean) {
    this.setState({shouldStoreKeyOnServer})
  }

  render () {
    return (
      <StandardScreen notification={{type: 'success', message: 'Your PGP key was generated!'}}>
        <Icon style={styleIcon} type='icon-pgp-key-48' />
        <Text style={styleTitle} type='Header'>Here is your unique public key!</Text>
        <textInput style={stylePgpKeyString} readOnly={true}>{this.props.pgpKeyString}</textInput>
        <Box style={styleUploadContainer}>
          <Checkbox onCheck={(newVal) => this._onCheckToggle(newVal)} checked={this.state.shouldStoreKeyOnServer} />
          <Box style={styleUploadTextContainer}>
            <Text style={styleUploadTextPrimary} type='BodySmall'>{'Store encrypted private key on Keybase’s server (recommended)'}</Text>
            <Text style={styleUploadTextSecondary} type='BodySmall'>{'Allows you to download & import your key to other devices.'}</Text>
          </Box>
        </Box>
        <Button style={styleDoneButton} type='Primary' onClick={() => this.props.onDone(this.state.shouldStoreKeyOnServer)} label={'Done, post to Keybase'} />
      </StandardScreen>
    )
  }
}

const styleIcon = {
  marginBottom: globalMargins.medium,
}

const styleTitle = {
  marginBottom: globalMargins.medium,
}

const stylePgpKeyString = {
  padding: 10,
  width: '100%',
  maxWidth: 512,
  maxHeight: 116,
  backgroundColor: globalColors.lightGrey,
  border: `solid 1px ${globalColors.black_10}`,
  borderRadius: 3,
  ...globalStyles.fontTerminal,
  fontSize: 14,
  lineHeight: '21px',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowY: 'auto',
  overflowX: 'hidden',
  textAlign: 'left',
  color: globalColors.black_75,
}

const styleUploadContainer = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
}

const styleUploadTextContainer = {
  ...globalStyles.flexBoxColumn,
  textAlign: 'left',
  marginLeft: globalMargins.tiny,
}

const styleUploadTextPrimary = {
  color: globalColors.black_75,
}

const styleUploadTextSecondary = {
  color: globalColors.black_40,
}

const styleDoneButton = {
  marginTop: globalMargins.medium,
}

export default FinishedGeneratedPgp
