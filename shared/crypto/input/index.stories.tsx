import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/crypto'
import HiddenString from '../../util/hidden-string'
import {Input} from '.'

const cryptoCommon = {
  input: new HiddenString(''),
  inputType: 'text',
}
const storeCommon = Sb.createStoreWithCommon()
const store = {
  ...storeCommon,
  crypto: {
    decrypt: cryptoCommon,
    encrypt: cryptoCommon,
    sign: cryptoCommon,
    verify: cryptoCommon,
  },
}

const fileDroppedCounter = 0
const filePathPlaintext = '/path/to/file.pdf'
const filePathEncrypted = '/path/to/file.pdf.encrypted.saltpack'
const filePathSigned = '/path/to/file.pdf.signed.saltpack'
const shortText = 'plaintext'
const longText = Array(1500)
  .fill(shortText)
  .join(' ')

const load = () => {
  Sb.storiesOf('Crypto/Input', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Text - Empty ', () => (
      <Input operation={Constants.Operations.Encrypt} fileDroppedCounter={fileDroppedCounter} />
    ))
  Sb.storiesOf('Crypto/Input', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.encrypt.input = new HiddenString(shortText)
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('Text - Short ', () => (
      <Input operation={Constants.Operations.Encrypt} fileDroppedCounter={fileDroppedCounter} />
    ))
  Sb.storiesOf('Crypto/Input', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.encrypt.input = new HiddenString(longText)
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('Text - Long ', () => (
      <Input operation={Constants.Operations.Encrypt} fileDroppedCounter={fileDroppedCounter} />
    ))

  Sb.storiesOf('Crypto/Input', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.encrypt.inputType = 'file'
          draftState.crypto.encrypt.input = new HiddenString(filePathPlaintext)
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('File - Plain (Encrypt & Sign) ', () => (
      <Input operation={Constants.Operations.Encrypt} fileDroppedCounter={fileDroppedCounter} />
    ))
  Sb.storiesOf('Crypto/Input', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.decrypt.inputType = 'file'
          draftState.crypto.decrypt.input = new HiddenString(filePathEncrypted)
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('File - Encrypted (Decrypt)', () => (
      <Input operation={Constants.Operations.Decrypt} fileDroppedCounter={fileDroppedCounter} />
    ))

  Sb.storiesOf('Crypto/Input', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.verify.inputType = 'file'
          draftState.crypto.verify.input = new HiddenString(filePathSigned)
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('File - Signed (Verify)', () => (
      <Input operation={Constants.Operations.Verify} fileDroppedCounter={fileDroppedCounter} />
    ))
}

export default load
