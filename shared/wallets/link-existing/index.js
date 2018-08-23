// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {ValidationState} from '../../constants/types/wallets'
type View = 'key' | 'name'

type Props = {
  secretKey: string,
  linkExistingAccountError: string,
  onCancel: () => void,
  onCheckKey: (key: string) => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onDone: () => void,
  onNameChange: string => void,
  onKeyChange: string => void,
  keyError: string,
  name: string,
  nameError: string,
  nameValidationState: ValidationState,
  secretKeyValidationState: ValidationState,
  view?: View,
  waiting: boolean,
}

type State = {
  view: View,
}

class LinkWallet extends React.Component<Props, State> {
  state = {view: this.props.view || 'key'}
  _onViewChange = (view: View) => this.setState(s => (s.view !== view ? {view} : null))

  _onCheckKey = () => {
    this.props.onCheckKey(this.props.secretKey)
  }

  _onCheckName = () => {
    this.props.onCheckName(this.props.name)
  }

  componentDidMount() {
    this.props.onClearErrors()
  }
  componentWillUnmount() {
    this.props.onClearErrors()
  }
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.secretKeyValidationState === 'valid' && this.state.view === 'key') {
      this.props.onClearErrors()
      this._onViewChange('name')
    }
    if (this.props.nameValidationState === 'valid' && this.state.view === 'name') {
      this.props.onClearErrors()
      this.props.onDone()
    }
  }

  render() {
    let view

    switch (this.state.view) {
      case 'key':
        view = (
          <EnterKey
            error={this.props.keyError || this.props.linkExistingAccountError}
            secretKey={this.props.secretKey}
            onCancel={this.props.onCancel}
            onKeyChange={this.props.onKeyChange}
            onNext={this._onCheckKey}
            waiting={this.props.secretKeyValidationState === 'waiting' || this.props.waiting}
          />
        )
        break
      case 'name':
        view = (
          <EnterName
            error={this.props.nameError || this.props.linkExistingAccountError}
            name={this.props.name}
            onBack={() => this._onViewChange('key')}
            onCancel={this.props.onCancel}
            onNameChange={this.props.onNameChange}
            onDone={this._onCheckName}
            waiting={this.props.nameValidationState === 'waiting' || this.props.waiting}
          />
        )
        break
      default:
        /*::
        declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (view: empty) => any
        ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(this.state.view);
        */
        throw new Error('LinkExistingWallet: Unexpected value for `view` encountered: ' + this.state.view)
    }
    // TODO: Refactor to use WalletPopup
    return <Kb.MaybePopup onClose={this.props.onCancel}>{view}</Kb.MaybePopup>
  }
}

type EnterKeyProps = {
  error: string,
  onCancel: () => void,
  onKeyChange: string => void,
  onNext: () => void,
  secretKey: string,
  waiting: boolean,
}

const EnterKey = (props: EnterKeyProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    style={Styles.collapseStyles([styles.popupContainer, styles.container])}
  >
    <Kb.Box2
      direction="vertical"
      gap="medium"
      fullWidth={true}
      fullHeight={true}
      style={styles.contentContainer}
    >
      <Kb.Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Kb.Text type="Header">Link an existing account</Kb.Text>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Kb.Text type="BodySmall" style={{color: Styles.globalColors.blue}}>
          Paste your secret key
        </Kb.Text>
        <Kb.Input
          hideLabel={true}
          multiline={true}
          rowsMin={2}
          rowsMax={2}
          hideUnderline={true}
          inputStyle={styles.inputElement}
          style={styles.input}
          onChangeText={props.onKeyChange}
          value={props.secretKey}
        />
        {props.error && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.error}
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.InfoNote>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2 direction="horizontal" gap="xtiny">
            <Kb.Text type="BodySmall" lineClamp={1} style={styles.textCenter}>
              Example:
            </Kb.Text>
            <Kb.Text type="BodySmall" lineClamp={1} ellipsizeMode="middle">
              SDNBUWJ34218239OAOPAMBCLDLSNBSC7632
            </Kb.Text>
          </Kb.Box2>
          <Kb.Text type="BodySmall" style={styles.textCenter}>
            This imports a Stellar secret key so you can also use it in Keybase. You can continue to use this
            Stellar account in other wallet apps.
          </Kb.Text>
        </Kb.Box2>
      </Kb.InfoNote>
    </Kb.Box2>
    <Kb.ButtonBar>
      <Kb.Button type="Secondary" onClick={props.onCancel} label="Cancel" />
      <Kb.Button type="Wallet" onClick={props.onNext} label="Next" waiting={props.waiting} />
    </Kb.ButtonBar>
  </Kb.Box2>
)

type EnterNameProps = {
  error: string,
  name: string,
  onBack: ?() => void,
  onCancel: () => void,
  onNameChange: string => void,
  onDone: () => void,
  waiting: boolean,
}

const EnterName = (props: EnterNameProps) => (
  <Kb.Box2 direction="vertical" style={styles.popupContainer}>
    <Kb.HeaderHocHeader onBack={props.onBack} headerStyle={styles.header} />
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        gap="medium"
        fullWidth={true}
        fullHeight={true}
        style={styles.contentContainer}
      >
        <Kb.Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
        <Kb.Text type="Header">Name your account</Kb.Text>
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
          <Kb.Text type="BodySmall" style={{color: Styles.globalColors.blue}}>
            Account name
          </Kb.Text>
          <Kb.Input
            hideLabel={true}
            hideUnderline={true}
            inputStyle={Styles.collapseStyles([styles.inputElement, styles.tallSingleLineInput])}
            style={styles.input}
            value={props.name}
            onChangeText={props.onNameChange}
          />
          {props.error && (
            <Kb.Text type="BodySmall" style={styles.error}>
              {props.error}
            </Kb.Text>
          )}
        </Kb.Box2>
        <Kb.InfoNote>
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySmall" style={styles.textCenter}>
              Your account name is encrypted and only visible to you.
            </Kb.Text>
          </Kb.Box2>
        </Kb.InfoNote>
      </Kb.Box2>
      <Kb.ButtonBar>
        <Kb.Button type="Secondary" onClick={props.onCancel} label="Cancel" />
        <Kb.Button type="Wallet" onClick={props.onDone} label="Done" waiting={props.waiting} />
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)

type WrapperState = {|
  secretKey: string,
  name: string,
|}

type WrapperProps = {
  linkExistingAccountError: string,
  onCancel: () => void,
  onCheckKey: (key: string) => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onDone: (secretKey: string, name: string) => void,
  keyError: string,
  nameError: string,
  nameValidationState: ValidationState,
  secretKeyValidationState: ValidationState,
  waiting: boolean,
}

class Wrapper extends React.Component<WrapperProps, WrapperState> {
  state = {secretKey: '', name: ''}
  _onKeyChange = (secretKey: string) => this.setState({secretKey})
  _onNameChange = (name: string) => this.setState({name})
  _onDone = () => this.props.onDone(this.state.secretKey, this.state.name)
  render() {
    return (
      <LinkWallet
        {...this.state}
        linkExistingAccountError={this.props.linkExistingAccountError}
        onCancel={this.props.onCancel}
        onCheckKey={this.props.onCheckKey}
        onCheckName={this.props.onCheckName}
        onClearErrors={this.props.onClearErrors}
        onDone={this._onDone}
        onKeyChange={this._onKeyChange}
        onNameChange={this._onNameChange}
        keyError={this.props.keyError}
        nameError={this.props.nameError}
        nameValidationState={this.props.nameValidationState}
        secretKeyValidationState={this.props.secretKeyValidationState}
        waiting={this.props.waiting}
      />
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.medium,
  },
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flex: 1,
  },
  error: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
  header: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  input: Styles.platformStyles({common: {margin: 0}, isElectron: {width: '100%'}}),
  inputContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-start',
    },
    isElectron: {width: '100%'},
  }),
  inputElement: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      padding: Styles.globalMargins.xtiny,
      textAlign: 'left',
    },
    isElectron: {
      minWidth: 0,
      width: '100%',
    },
    isMobile: {
      minWidth: '100%',
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
  }),
  popupContainer: {
    height: 525,
    width: 360,
  },
  tallSingleLineInput: Styles.platformStyles({
    isMobile: {
      minHeight: 32,
      paddingBottom: 0,
      paddingTop: 0,
    },
  }),
  textCenter: {textAlign: 'center'},
})

export {EnterName, Wrapper}
export default LinkWallet
