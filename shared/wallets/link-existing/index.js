// @flow
import * as React from 'react'
import {Box2, Icon, Text, Input} from '../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'

type View = 'enter-key' | 'enter-name'

type Props = {
  onCancel: () => void,
  onDone: () => void,
  onNameChange: string => void,
  onKeyChange: string => void,
  onViewChange: View => void,
  name: string,
  secretKey: string,
  view: View,
}

const LinkWallet = (props: Props) => {
  if (props.view === 'enter-key') {
    return (
      <EnterKey
        onCancel={props.onCancel}
        onKeyChange={props.onKeyChange}
        onNext={() => props.onViewChange('enter-name')}
        secretKey={props.secretKey}
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
  secretKey: string,
}

const EnterKey = (props: EnterKeyProps) => {
  return (
    <Box2 direction="vertical" gap="medium" fullWidth={true} style={styles.container}>
      <Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Text type="BodySmall" style={{color: globalColors.blue}}>
          Paste your secret key
        </Text>
        <Input
          multiline={true}
          rowsMin={2}
          rowsMax={2}
          hideUnderline={true}
          inputStyle={styles.inputElement}
          small={true}
          style={styles.input}
          onChangeText={props.onKeyChange}
        />
      </Box2>
    </Box2>
  )
}

type EnterNameProps = {
  name: string,
  onCancel: () => void,
  onNameChange: string => void,
  onDone: () => void,
}

const EnterName = (props: EnterNameProps) => {}

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    padding: globalMargins.medium,
  },
  input: {margin: 0},
  inputContainer: {
    alignItems: 'flex-start',
  },
  inputElement: {
    borderColor: globalColors.black_10,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    paddingBottom: 2,
    paddingTop: 2,
    textAlign: 'left',
  },
})

export default LinkWallet
