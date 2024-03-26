import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import Modal from '@/profile/modal'

type Props = {
  onDone: (shouldStoreKeyOnServer: boolean) => void
  promptShouldStoreKeyOnServer: boolean
  pgpKeyString: string
}

type State = {
  shouldStoreKeyOnServer: boolean
}

export class Finished extends React.Component<Props, State> {
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
          <textarea
            style={Kb.Styles.castStyleDesktop(styles.pgpKeyString)}
            readOnly={true}
            value={this.props.pgpKeyString}
          />
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      pgpKeyString: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fontTerminal,
          backgroundColor: Kb.Styles.globalColors.greyLight,
          border: `solid 1px ${Kb.Styles.globalColors.black_10}`,
          borderRadius: 3,
          color: Kb.Styles.globalColors.black,
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
        } as const,
      }),
    }) as const
)

const Container = () => {
  const pgpKeyString = C.useProfileState(s => s.pgpPublicKey || 'Error getting public key...')
  const promptShouldStoreKeyOnServer = C.useProfileState(s => s.promptShouldStoreKeyOnServer)
  const finishedWithKeyGen = C.useProfileState(s => s.dispatch.dynamic.finishedWithKeyGen)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onDone = (shouldStoreKeyOnServer: boolean) => {
    finishedWithKeyGen?.(shouldStoreKeyOnServer)
    clearModals()
  }
  const props = {
    onDone,
    pgpKeyString,
    promptShouldStoreKeyOnServer,
  }
  return <Finished {...props} />
}

export default Container
