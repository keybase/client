import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import HiddenString from '../../../util/hidden-string'
import Sign from '.'

const operation = 'sign'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    bytesComplete: state.crypto.sign.bytesComplete,
    bytesTotal: state.crypto.sign.bytesTotal,
    input: state.crypto.sign.input.stringValue(),
    inputType: state.crypto.sign.inputType,
    output: state.crypto.sign.output.stringValue(),
    outputSender: state.crypto.sign.outputSender?.stringValue(),
    outputStatus: state.crypto.sign.outputStatus,
    outputType: state.crypto.sign.outputType,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onDownloadText: () => dispatch(CryptoGen.createDownloadSignedText()),
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
    onDownloadText: dispatchProps.onDownloadText,
    onSetInput: dispatchProps.onSetInput,
    onShowInFinder: dispatchProps.onShowInFinder,
    output: stateProps.output,
    outputSender: stateProps.outputSender,
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
    progress: stateProps.bytesComplete === 0 ? 0 : stateProps.bytesComplete / stateProps.bytesTotal,
  }),
  'SignContainer'
)(Sign)
