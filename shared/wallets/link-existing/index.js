// @flow
import * as React from 'react'
import {Box2, Button, ButtonBar, Icon, InfoNote, Text, Input} from '../../common-adapters'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate, platformStyles} from '../../styles'

type View = 'key' | 'name'

type Props = {
  secretKey: string,
  onCancel: () => void,
  onDone: () => void,
  onNameChange: string => void,
  onKeyChange: string => void,
  onViewChange: View => void,
  name: string,
  view: View,
}

const LinkWallet = (props: Props) => {
  switch (props.view) {
    case 'key':
      return (
        <EnterKey
          secretKey={props.secretKey}
          onCancel={props.onCancel}
          onKeyChange={props.onKeyChange}
          onNext={() => props.onViewChange('name')}
        />
      )
    case 'name':
      return (
        <EnterName
          name={props.name}
          onCancel={props.onCancel}
          onNameChange={props.onNameChange}
          onDone={props.onDone}
        />
      )
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (view: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(props.view);
      */
      throw new Error('LinkExistingWallet: Unexpected value for `view` encountered: ' + props.view)
  }
}

type EnterKeyProps = {
  onCancel: () => void,
  onKeyChange: string => void,
  onNext: () => void,
}

const EnterKey = (props: EnterKeyProps) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Box2
      direction="vertical"
      gap="medium"
      fullWidth={true}
      fullHeight={true}
      style={styles.contentContainer}
    >
      <Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Text type="Header">Link an existing wallet</Text>
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
        />
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
      <Button type="Wallet" onClick={props.onNext} label="Next" />
    </ButtonBar>
  </Box2>
)

type EnterNameProps = {
  name: string,
  onCancel: () => void,
  onNameChange: string => void,
  onDone: () => void,
}

const EnterName = (props: EnterNameProps) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Box2
      direction="vertical"
      gap="medium"
      fullWidth={true}
      fullHeight={true}
      style={styles.contentContainer}
    >
      <Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Text type="Header">Name your wallet</Text>
      <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Text type="BodySmall" style={{color: globalColors.blue}}>
          Wallet name
        </Text>
        <Input
          hideLabel={true}
          hideUnderline={true}
          inputStyle={collapseStyles([styles.inputElement, styles.tallSingleLineInput])}
          style={styles.input}
          value={props.name}
          onChangeText={props.onNameChange}
        />
      </Box2>
      <InfoNote>
        <Box2 direction="vertical" fullWidth={true}>
          <Text type="BodySmall" style={styles.textCenter}>
            Your wallet name is encrypted and only visible to you.
          </Text>
        </Box2>
      </InfoNote>
    </Box2>
    <ButtonBar>
      <Button type="Secondary" onClick={props.onCancel} label="Cancel" />
      <Button type="Wallet" onClick={props.onDone} label="Done" />
    </ButtonBar>
  </Box2>
)

type WrapperState = {|
  secretKey: string,
  name: string,
  view: View,
|}

type WrapperProps = {
  onCancel: () => void,
  onDone: () => void,
}

class Wrapper extends React.Component<WrapperProps, WrapperState> {
  state = {secretKey: '', name: '', view: 'key'}
  _onKeyChange = (secretKey: string) => this.setState({secretKey})
  _onNameChange = (name: string) => this.setState({name})
  _onViewChange = (view: View) => this.setState({view})
  render() {
    return (
      <LinkWallet
        {...this.props}
        {...this.state}
        onKeyChange={this._onKeyChange}
        onNameChange={this._onNameChange}
        onViewChange={this._onViewChange}
      />
    )
  }
}

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.medium,
    maxWidth: 500,
  },
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flex: 1,
  },
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
