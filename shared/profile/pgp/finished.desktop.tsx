import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {namedConnect} from '../../util/container'
import Modal from '../modal'

type OwnProps = {}

type Props = {
  onDone: (shouldStoreKeyOnServer: boolean) => void
  promptShouldStoreKeyOnServer: boolean
  pgpKeyString: string
}

type State = {
  shouldStoreKeyOnServer: boolean
}

class Finished extends React.Component<Props, State> {
  state = {shouldStoreKeyOnServer: false}

  _onCheckToggle(shouldStoreKeyOnServer: boolean) {
    this.setState({shouldStoreKeyOnServer})
  }

  render() {
    return (
      <Modal>
        <Kb.Box2 direction="vertical" alignItems="center" gap="tiny">
          <Kb.PlatformIcon platform="pgp" overlay="icon-proof-success" />
          <Kb.Text type="Header">Here is your unique public key!</Kb.Text>
          <Kb.Text type="Body">
            Your private key has been written to Keybase’s local keychain. You can learn to use it with
            `keybase pgp help` from your terminal. If you have GPG installed, it has also been written to
            GPG’s keychain.
          </Kb.Text>
          <textarea style={styles.pgpKeyString} readOnly={true} value={this.props.pgpKeyString} />
          {this.props.promptShouldStoreKeyOnServer && (
            <Kb.Box2 direction="vertical">
              <Kb.Checkbox
                onCheck={newVal => this._onCheckToggle(newVal)}
                checked={this.state.shouldStoreKeyOnServer}
                label="Store encrypted private key on Keybase's server"
              />
              <Kb.Text type="BodySmall">
                Allows you to download & import your key to other devices. You might need to enter your
                Keybase password.{' '}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Button
            onClick={() => this.props.onDone(this.state.shouldStoreKeyOnServer)}
            label={this.state.shouldStoreKeyOnServer ? 'Done, post to Keybase' : 'Done'}
          />
        </Kb.Box2>
      </Modal>
    )
  }
}

const styles = Styles.styleSheetCreate({
  pgpKeyString: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fontTerminal,
      backgroundColor: Styles.globalColors.greyLight,
      border: `solid 1px ${Styles.globalColors.black_10}`,
      borderRadius: 3,
      color: Styles.globalColors.black,
      flexGrow: 1,
      fontSize: 12,
      lineHeight: 17,
      minHeight: 116,
      overflowX: 'hidden',
      overflowY: 'auto',
      padding: 10,
      textAlign: 'left',
      userSelect: 'all',
      whiteSpace: 'pre-wrap',
      width: '100%',
      wordWrap: 'break-word',
    },
  }),
})

export default namedConnect(
  state => ({
    pgpKeyString: state.profile.pgpPublicKey || 'Error getting public key...',
    promptShouldStoreKeyOnServer: state.profile.promptShouldStoreKeyOnServer,
  }),
  dispatch => ({
    onDone: shouldStoreKeyOnServer => {
      dispatch(ProfileGen.createFinishedWithKeyGen({shouldStoreKeyOnServer}))
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Finished'
)(Finished)
