// @flow
import * as React from 'react'
import {Box2, Button, ButtonBar, HeaderHocHeader, Icon, InfoNote, Text, Input} from '../../common-adapters'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate, platformStyles} from '../../styles'
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
}

type State = {
  view: View,
}

class LinkWallet extends React.Component<Props, State> {
  state = {view: 'key'}
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
    switch (this.state.view) {
      case 'key':
        return (
          <EnterKey
            error={this.props.keyError || this.props.linkExistingAccountError}
            secretKey={this.props.secretKey}
            onCancel={this.props.onCancel}
            onKeyChange={this.props.onKeyChange}
            onNext={this._onCheckKey}
            waiting={this.props.secretKeyValidationState === 'waiting'}
          />
        )
      case 'name':
        return (
          <EnterName
            error={this.props.nameError || this.props.linkExistingAccountError}
            name={this.props.name}
            onBack={() => this._onViewChange('key')}
            onCancel={this.props.onCancel}
            onNameChange={this.props.onNameChange}
            onDone={this._onCheckName}
            waiting={this.props.nameValidationState === 'waiting'}
          />
        )
      default:
        /*::
        declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (view: empty) => any
        ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(this.state.view);
        */
        throw new Error('LinkExistingWallet: Unexpected value for `view` encountered: ' + this.state.view)
    }
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
  <Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    style={collapseStyles([styles.popupContainer, styles.container])}
  >
    <Box2
      direction="vertical"
      gap="medium"
      fullWidth={true}
      fullHeight={true}
      style={styles.contentContainer}
    >
      <Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Text type="Header">Link an existing account</Text>
      <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Text type="BodySmall" style={{color: globalColors.blue}}>
          Paste your secret key
        </Text>
        <Input
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
          <Text type="BodySmall" style={styles.error}>
            {props.error}
          </Text>
        )}
      </Box2>
      <InfoNote>
        <Box2 direction="vertical" fullWidth={true}>
          <Box2 direction="horizontal" gap="xtiny">
            <Text type="BodySmall" lineClamp={1} style={styles.textCenter}>
              Example:
            </Text>
            <Text type="BodySmall" lineClamp={1} ellipsizeMode="middle">
              SDNBUWJ34218239OAOPAMBCLDLSNBSC7632
            </Text>
          </Box2>
          <Text type="BodySmall" style={styles.textCenter}>
            This imports a Stellar secret key so you can also use it in Keybase. You can continue to use this
            Stellar account in other wallet apps.
          </Text>
        </Box2>
      </InfoNote>
    </Box2>
    <ButtonBar>
      <Button type="Secondary" onClick={props.onCancel} label="Cancel" />
      <Button type="Wallet" onClick={props.onNext} label="Next" waiting={props.waiting} />
    </ButtonBar>
  </Box2>
)

type EnterNameProps = {
  error: string,
  name: string,
  onBack: () => void,
  onCancel: () => void,
  onNameChange: string => void,
  onDone: () => void,
  waiting: boolean,
}

const EnterName = (props: EnterNameProps) => (
  <Box2 direction="vertical" style={styles.popupContainer}>
    <HeaderHocHeader onBack={props.onBack} headerStyle={styles.header} />
    <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Box2
        direction="vertical"
        gap="medium"
        fullWidth={true}
        fullHeight={true}
        style={styles.contentContainer}
      >
        <Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
        <Text type="Header">Name your account</Text>
        <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
          <Text type="BodySmall" style={{color: globalColors.blue}}>
            Account name
          </Text>
          <Input
            hideLabel={true}
            hideUnderline={true}
            inputStyle={collapseStyles([styles.inputElement, styles.tallSingleLineInput])}
            style={styles.input}
            value={props.name}
            onChangeText={props.onNameChange}
          />
          {props.error && (
            <Text type="BodySmall" style={styles.error}>
              {props.error}
            </Text>
          )}
        </Box2>
        <InfoNote>
          <Box2 direction="vertical" fullWidth={true}>
            <Text type="BodySmall" style={styles.textCenter}>
              Your account name is encrypted and only visible to you.
            </Text>
          </Box2>
        </InfoNote>
      </Box2>
      <ButtonBar>
        <Button type="Secondary" onClick={props.onCancel} label="Cancel" />
        <Button type="Wallet" onClick={props.onDone} label="Done" waiting={props.waiting} />
      </ButtonBar>
    </Box2>
  </Box2>
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
      />
    )
  }
}

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.medium,
  },
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flex: 1,
  },
  error: platformStyles({
    common: {
      color: globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
  header: platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  input: platformStyles({common: {margin: 0}, isElectron: {width: '100%'}}),
  inputContainer: platformStyles({
    common: {
      alignItems: 'flex-start',
    },
    isElectron: {width: '100%'},
  }),
  inputElement: platformStyles({
    common: {
      borderColor: globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      padding: globalMargins.xtiny,
      textAlign: 'left',
    },
    isElectron: {
      minWidth: 0,
      width: '100%',
    },
    isMobile: {minWidth: '100%', paddingBottom: globalMargins.xtiny, paddingTop: globalMargins.xtiny},
  }),
  popupContainer: {
    height: 450,
    maxWidth: 360,
  },
  tallSingleLineInput: platformStyles({
    isMobile: {
      minHeight: 32,
      paddingBottom: 0,
      paddingTop: 0,
    },
  }),
  textCenter: {textAlign: 'center'},
})

export {Wrapper}
export default LinkWallet
