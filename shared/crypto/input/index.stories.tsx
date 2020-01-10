import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/crypto'
import {TextInput, FileInput} from '.'

const onClearInput = Sb.action('onClearInput')
const onChangeText = Sb.action('onChangeText')

const shortText = 'plaintext'
const longText = Array(1500)
  .fill(shortText)
  .join(' ')

const load = () => {
  Sb.storiesOf('Crypto/Input/Text', module)
    .add('Empty', () => (
      <TextInput
        textType="plain"
        value=""
        placeholder="Write something or drop a file you want to encrypt"
        onChangeText={onChangeText}
        operation={Constants.Operations.Encrypt}
      />
    ))

    .add('Value - Short', () => (
      <TextInput
        textType="plain"
        value={shortText}
        placeholder="Write something or drop a file you want to encrypt"
        onChangeText={onChangeText}
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Value - Long', () => (
      <TextInput
        textType="plain"
        value={longText}
        placeholder="Write something or drop a file you want to encrypt"
        onChangeText={onChangeText}
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Empty - Cipher', () => (
      <TextInput
        textType="cipher"
        value=""
        placeholder="Write something or drop a file you want to encrypt"
        onChangeText={onChangeText}
        operation={Constants.Operations.Decrypt}
      />
    ))

    .add('Value - Short - Cipher', () => (
      <TextInput
        textType="cipher"
        value={shortText}
        placeholder="Write something or drop a file you want to encrypt"
        onChangeText={onChangeText}
        operation={Constants.Operations.Decrypt}
      />
    ))
    .add('Value - Long - Cipher', () => (
      <TextInput
        textType="cipher"
        value={longText}
        placeholder="Write something or drop a file you want to encrypt"
        onChangeText={onChangeText}
        operation={Constants.Operations.Decrypt}
      />
    ))

  Sb.storiesOf('Crypto/Input/File', module)
    .add('Plain', () => (
      <FileInput
        path="/path/to/file.txt"
        size={1024}
        operation={Constants.Operations.Encrypt}
        onClearFiles={onClearInput}
      />
    ))
    .add('Encrypted', () => (
      <FileInput
        path="/path/to/file.txt"
        size={1024}
        operation={Constants.Operations.Decrypt}
        onClearFiles={onClearInput}
      />
    ))
    .add('Signed', () => (
      <FileInput
        path="/path/to/file.txt"
        size={1024}
        operation={Constants.Operations.Verify}
        onClearFiles={onClearInput}
      />
    ))
}

export default load
