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
    bytesComplete: state.crypto.encrypt.bytesComplete,
    bytesTotal: state.crypto.encrypt.bytesTotal,
    errorMessage: state.crypto.encrypt.errorMessage.stringValue(),
    hasRecipients: state.crypto.encrypt.meta.hasRecipients,
    hasSBS: state.crypto.encrypt.meta.hasSBS,
    input: state.crypto.encrypt.input.stringValue(),
    inputType: state.crypto.encrypt.inputType,
    noIncludeSelf: state.crypto.encrypt.meta.noIncludeSelf,
    options: state.crypto.encrypt.options,
    output: state.crypto.encrypt.output.stringValue(),
    outputStatus: state.crypto.encrypt.outputStatus,
    outputType: state.crypto.encrypt.outputType,
    recipients: state.crypto.encrypt.recipients,
    username: state.config.username,
    warningMessage: state.crypto.encrypt.warningMessage.stringValue(),
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onDownloadText: () => dispatch(CryptoGen.createDownloadEncryptedText()),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onSetOptions: (options: Types.EncryptOptions) => dispatch(CryptoGen.createSetEncryptOptions({options})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => ({
    errorMessage: stateProps.errorMessage,
    hasRecipients: stateProps.hasRecipients,
    hasSBS: stateProps.hasSBS,
    input: stateProps.input,
    inputType: stateProps.inputType,
    noIncludeSelf: stateProps.noIncludeSelf,
    onClearInput: dispatchProps.onClearInput,
    onCopyOutput: dispatchProps.onCopyOutput,
    onDownloadText: dispatchProps.onDownloadText,
    onSetInput: dispatchProps.onSetInput,
    onSetOptions: dispatchProps.onSetOptions,
    onShowInFinder: dispatchProps.onShowInFinder,
    options: stateProps.options,
    output: stateProps.output,
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
    progress: stateProps.bytesComplete === 0 ? 0 : stateProps.bytesComplete / stateProps.bytesTotal,
    recipients: stateProps.recipients,
    username: stateProps.username,
    warningMessage: stateProps.warningMessage,
  }),
  'EncryptContainer'
)(Encrypt)
