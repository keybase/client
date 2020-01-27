import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import HiddenString from '../../../util/hidden-string'
import Encrypt from '.'

const operation = 'encrypt'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    _encrypt: state.crypto.encrypt,
    username: state.config.username,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSaveAsText: () => dispatch(CryptoGen.createDownloadEncryptedText()),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onSetOptions: (options: Types.EncryptOptions) => dispatch(CryptoGen.createSetEncryptOptions({options})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => {
    const {_encrypt, username} = stateProps
    const {errorMessage, input, inputType, options, meta} = _encrypt
    const {noIncludeSelf, hasSBS, hasRecipients} = meta
    const {bytesComplete, bytesTotal, recipients, warningMessage} = _encrypt
    const {output, outputStatus, outputType, outputMatchesInput} = _encrypt
    const {onClearInput, onCopyOutput, onSaveAsText, onSetInput, onSetOptions, onShowInFinder} = dispatchProps
    return {
      bytesTotal,
      errorMessage: errorMessage.stringValue(),
      hasRecipients,
      hasSBS,
      input: input.stringValue(),
      inputType,
      noIncludeSelf,
      onClearInput,
      onCopyOutput,
      onSaveAsText,
      onSetInput,
      onSetOptions,
      onShowInFinder,
      options,
      output: output.stringValue(),
      outputMatchesInput,
      outputStatus,
      outputType,
      progress: bytesComplete === 0 ? 0 : bytesComplete / bytesTotal,
      recipients,
      username,
      warningMessage: warningMessage.stringValue(),
    }
  },
  'EncryptContainer'
)(Encrypt)
