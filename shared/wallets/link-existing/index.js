// @flow
import * as React from 'react'
import {Box2, Button, ButtonBar, Icon, InfoNote, Text, Input} from '../../common-adapters'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate, platformStyles} from '../../styles'

type View = 'enter-key' | 'enter-name'

type Props = {
  onCancel: () => void,
  onDone: () => void,
  onNameChange: string => void,
  onKeyChange: string => void,
  onViewChange: View => void,
  name: string,
  view: View,
}

const LinkWallet = (props: Props) => {
  if (props.view === 'enter-key') {
    return (
      <EnterKey
        onCancel={props.onCancel}
        onKeyChange={props.onKeyChange}
        onNext={() => props.onViewChange('enter-name')}
      />
    )
  }
  return (
    <EnterName
      name={props.name}
      onCancel={props.onCancel}
      onNameChange={props.onNameChange}
      onDone={props.onDone}
    />
  )
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
          <Text type="BodySmall" lineClamp={1} style={styles.textCenter}>
            Example: SDNBUWJ34218239OAOPAMBCLDLSNBSC7632
          </Text>
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

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.medium,
  },
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flex: 1,
  },
  input: {margin: 0},
  inputContainer: {
    alignItems: 'flex-start',
  },
  inputElement: platformStyles({
    common: {
      borderColor: globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      padding: globalMargins.xtiny,
      textAlign: 'left',
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

export default LinkWallet
