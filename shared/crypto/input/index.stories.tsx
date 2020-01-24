import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/crypto'
import {TextInput, FileInput} from '.'

const onClearInput = Sb.action('onClearInput')
const onChangeText = Sb.action('onChangeText')
const onSetFile = Sb.action('onSetFile')

const shortText = 'plaintext'
const longText = Array(1500)
  .fill(shortText)
  .join(' ')

const load = () => {
  Sb.storiesOf('Crypto/Input/Text', module)
    .add('Empty - Encrypt', () => (
      <TextInput
        textType="plain"
        value=""
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Empty - Encrypt', () => (
      <TextInput
        textType="plain"
        value=""
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Empty - Encrypt', () => (
      <TextInput
        textType="plain"
        value=""
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Empty - Encrypt', () => (
      <TextInput
        textType="plain"
        value=""
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Encrypt}
      />
    ))

    .add('Value - Short', () => (
      <TextInput
        textType="plain"
        value={shortText}
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Value - Long', () => (
      <TextInput
        textType="plain"
        value={longText}
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Encrypt}
      />
    ))

    .add('Value - Short - Cipher', () => (
      <TextInput
        textType="cipher"
        value={shortText}
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
        operation={Constants.Operations.Decrypt}
      />
    ))
    .add('Value - Long - Cipher', () => (
      <TextInput
        textType="cipher"
        value={longText}
        placeholder="Write, paste, or drop a file you want to encrypt"
        onChangeText={onChangeText}
        onSetFile={onSetFile}
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
