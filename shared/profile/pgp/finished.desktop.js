// @flow
import * as ProfileGen from '../../actions/profile-gen'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {CHECKBOX_SIZE, CHECKBOX_MARGIN} from '../../common-adapters/checkbox.desktop'
import {namedConnect} from '../../util/container'

type OwnProps = {||}
type Props = {|
  onDone: (shouldStoreKeyOnServer: boolean) => void,
  pgpKeyString: string,
|}
type State = {|shouldStoreKeyOnServer: boolean|}

class Finished extends React.Component<Props, State> {
  state = {
    shouldStoreKeyOnServer: false,
  }

  _onCheckToggle(shouldStoreKeyOnServer: boolean) {
    this.setState({shouldStoreKeyOnServer})
  }

  render() {
    return (
      <Kb.StandardScreen notification={{message: 'Success!', type: 'success'}} style={{alignSelf: 'stretch'}}>
        <Kb.PlatformIcon style={styleIcon} platform="pgp" overlay="icon-proof-success" />
        <Kb.Text style={styleTitle} type="Header">
          Here is your unique public key!
        </Kb.Text>
        <Kb.Text style={Styles.collapseStyles([styleTitle, styleTextSpacing])} type="Body">
          Your private key has been written to Keybase’s local keychain. You can learn to use it with `keybase
          pgp help` from your terminal. If you have GPG installed, it has also been written to GPG’s keychain.
        </Kb.Text>
        <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignSelf: 'stretch'}}>
          <textarea style={stylePgpKeyString} readOnly={true} value={this.props.pgpKeyString} />
        </Kb.Box>
        <Kb.Box style={styleUploadContainer}>
          <Kb.Checkbox
            onCheck={newVal => this._onCheckToggle(newVal)}
            checked={this.state.shouldStoreKeyOnServer}
            label="Store encrypted private key on Keybase's server"
          />
          <Kb.Text style={styleUploadTextSublabel} type="BodySmall">
            {
              'Allows you to download & import your key to other devices. You might need to enter your Keybase passphrase.'
            }
          </Kb.Text>
        </Kb.Box>
        <Kb.Button
          style={styleDoneButton}
          type="Primary"
          onClick={() => this.props.onDone(this.state.shouldStoreKeyOnServer)}
          label={this.state.shouldStoreKeyOnServer ? 'Done, post to Keybase' : 'Done'}
        />
      </Kb.StandardScreen>
    )
  }
}

const styleIcon = {
  marginBottom: Styles.globalMargins.medium,
}

const styleTitle = {
  marginBottom: Styles.globalMargins.medium,
}

const styleTextSpacing = {
  paddingLeft: Styles.globalMargins.large,
  paddingRight: Styles.globalMargins.large,
}

const stylePgpKeyString = Styles.platformStyles({
  common: {
    ...Styles.globalStyles.fontTerminal,
    backgroundColor: Styles.globalColors.lightGrey,
    borderRadius: 3,
    color: Styles.globalColors.black_75,
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    minHeight: 116,
    padding: 10,
    textAlign: 'left',
  },
  isElectron: {
    border: `solid 1px ${Styles.globalColors.black_10}`,
    overflowX: 'hidden',
    overflowY: 'auto',
    userSelect: 'all',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
})

const styleUploadContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  flexShrink: 0,
  marginTop: Styles.globalMargins.small,
  textAlign: 'left',
}

const styleUploadTextSublabel = {
  color: Styles.globalColors.black_50,
  marginLeft: CHECKBOX_SIZE + CHECKBOX_MARGIN,
}

const styleDoneButton = {
  marginTop: Styles.globalMargins.medium,
}

const mapStateToProps = state => ({
  pgpKeyString: state.profile.pgpPublicKey || 'Error getting public key...',
})

const mapDispatchToProps = dispatch => ({
  onDone: shouldStoreKeyOnServer => dispatch(ProfileGen.createFinishedWithKeyGen({shouldStoreKeyOnServer})),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Finished'
)(Finished)
