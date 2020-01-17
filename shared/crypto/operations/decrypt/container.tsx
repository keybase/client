import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import HiddenString from '../../../util/hidden-string'
import Decrypt from '.'

const operation = 'decrypt'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    bytesComplete: state.crypto.decrypt.bytesComplete,
    bytesTotal: state.crypto.decrypt.bytesTotal,
    input: state.crypto.decrypt.input.stringValue(),
    inputType: state.crypto.decrypt.inputType,
    output: state.crypto.decrypt.output.stringValue(),
    outputSender: state.crypto.decrypt.outputSender?.stringValue(),
    outputSigned: state.crypto.decrypt.outputSigned,
    outputStatus: state.crypto.decrypt.outputStatus,
    outputType: state.crypto.decrypt.outputType,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => ({
    input: stateProps.input,
    inputType: stateProps.inputType,
    onClearInput: dispatchProps.onClearInput,
    onCopyOutput: dispatchProps.onCopyOutput,
    onSetInput: dispatchProps.onSetInput,
    onShowInFinder: dispatchProps.onShowInFinder,
    output: stateProps.output,
    outputSender: stateProps.outputSender,
    outputSigned: stateProps.outputSigned,
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
    progress: stateProps.bytesComplete === 0 ? 0 : stateProps.bytesComplete / stateProps.bytesTotal,
  }),
  'DecryptContainer'
)(Decrypt)
