// @flow
import React, {Component} from 'react'
import {StandardScreen, Box, Text, Button, PlatformIcon, Checkbox} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles/style-guide'
import {CHECKBOX_SIZE, CHECKBOX_MARGIN} from '../../common-adapters/checkbox.desktop'
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
        <PlatformIcon style={styleIcon} platform='pgp' overlay='icon-proof-success' size={48} />
        <Text style={styleTitle} type='Header'>Here is your unique public key!</Text>
        <textInput style={stylePgpKeyString} readOnly={true}>{this.props.pgpKeyString}</textInput>
        <Box style={styleUploadContainer}>
          <Checkbox onCheck={(newVal) => this._onCheckToggle(newVal)} checked={this.state.shouldStoreKeyOnServer} label='Store encrypted private key on Keybase’s server (recommended)' />
          <Text style={styleUploadTextSublabel} type='BodySmall'>{'Allows you to download & import your key to other devices.'}</Text>
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
  ...globalStyles.flexBoxColumn,
  textAlign: 'left',
  marginTop: globalMargins.small,
}

const styleUploadTextSublabel = {
  color: globalColors.black_40,
  marginLeft: CHECKBOX_SIZE + CHECKBOX_MARGIN,
}

const styleDoneButton = {
  marginTop: globalMargins.medium,
}

export default FinishedGeneratedPgp
