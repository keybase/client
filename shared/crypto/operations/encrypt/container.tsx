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
    hasRecipients: state.crypto.encrypt.meta.hasRecipients,
    input: state.crypto.encrypt.input.stringValue(),
    inputType: state.crypto.encrypt.inputType,
    noIncludeSelf: state.crypto.encrypt.meta.noIncludeSelf,
    options: state.crypto.encrypt.options,
    output: state.crypto.encrypt.output.stringValue(),
    outputStatus: state.crypto.encrypt.outputStatus,
    outputType: state.crypto.encrypt.outputType,
    username: state.config.username,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onSetOptions: (options: Types.EncryptOptions) => dispatch(CryptoGen.createSetEncryptOptions({options})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => ({
    hasRecipients: stateProps.hasRecipients,
    input: stateProps.input,
    inputType: stateProps.inputType,
    noIncludeSelf: stateProps.noIncludeSelf,
    onClearInput: dispatchProps.onClearInput,
    onCopyOutput: dispatchProps.onCopyOutput,
    onSetInput: dispatchProps.onSetInput,
    onSetOptions: dispatchProps.onSetOptions,
    onShowInFinder: dispatchProps.onShowInFinder,
    options: stateProps.options,
    output: stateProps.output,
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
    username: stateProps.username,
  }),
  'EncryptContainer'
)(Encrypt)
