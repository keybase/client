// @flow
import React, {Component} from 'react'
import {Box, Button, Checkbox, PlatformIcon, StandardScreen, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import type {Props} from './finished-generating-pgp'

import {CHECKBOX_SIZE, CHECKBOX_MARGIN} from '../../common-adapters/checkbox.desktop'

type State = {
  shouldStoreKeyOnServer: boolean,
}

class FinishedGeneratedPgp extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      shouldStoreKeyOnServer: false,
    }
  }

  _onCheckToggle(shouldStoreKeyOnServer: boolean) {
    this.setState({shouldStoreKeyOnServer})
  }

  render() {
    return (
      <StandardScreen
        notification={{type: 'success', message: 'Your PGP key was generated!'}}
        style={{alignSelf: 'stretch'}}
      >
        <PlatformIcon style={styleIcon} platform="pgp" overlay="icon-proof-success" />
        <Text style={styleTitle} type="Header">
          Here is your unique public key!
        </Text>
        <Box style={{...globalStyles.flexBoxRow, alignSelf: 'stretch'}}>
          <textinput style={stylePgpKeyString} readOnly={true}>
            {this.props.pgpKeyString}
          </textinput>
        </Box>
        <Box style={styleUploadContainer}>
          <Checkbox
            onCheck={newVal => this._onCheckToggle(newVal)}
            checked={this.state.shouldStoreKeyOnServer}
            label="Store encrypted private key on Keybase's server (recommended)"
          />
          <Text style={styleUploadTextSublabel} type="BodySmall">
            {'Allows you to download & import your key to other devices.'}
          </Text>
        </Box>
        <Button
          style={styleDoneButton}
          type="Primary"
          onClick={() => this.props.onDone(this.state.shouldStoreKeyOnServer)}
          label={this.state.shouldStoreKeyOnServer ? 'Done, post to Keybase' : 'Done'}
        />
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

const stylePgpKeyString = platformStyles({
  common: {
    ...globalStyles.fontTerminal,
    backgroundColor: globalColors.lightGrey,
    borderRadius: 3,
    color: globalColors.black_75,
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    minHeight: 116,
    padding: 10,
    textAlign: 'left',
  },
  isElectron: {
    border: `solid 1px ${globalColors.black_10}`,
    overflowX: 'hidden',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
})

const styleUploadContainer = {
  ...globalStyles.flexBoxColumn,
  flexShrink: 0,
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
