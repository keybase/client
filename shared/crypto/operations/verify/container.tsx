import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import HiddenString from '../../../util/hidden-string'
import Verify from '.'

const operation = 'verify'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    input: state.crypto.verify.input.stringValue(),
    inputType: state.crypto.verify.inputType,
    output: state.crypto.verify.output.stringValue(),
    outputSender: state.crypto.verify.outputSender?.stringValue(),
    outputStatus: state.crypto.verify.outputStatus,
    outputType: state.crypto.verify.outputType,
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
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
  }),
  'VerifyContainer'
)(Verify)
