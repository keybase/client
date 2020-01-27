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
    _verify: state.crypto.verify,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => {
    const {onClearInput, onCopyOutput, onSetInput, onShowInFinder} = dispatchProps
    const {_verify} = stateProps
    const {bytesComplete, bytesTotal, inputType, outputStatus, outputType} = _verify
    const {errorMessage, warningMessage, output, outputSender, input, outputMatchesInput} = _verify
    return {
      errorMessage: errorMessage.stringValue(),
      input: input.stringValue(),
      inputType,
      onClearInput,
      onCopyOutput,
      onSetInput,
      onShowInFinder,
      output: output.stringValue(),
      outputMatchesInput,
      outputSender: outputSender?.stringValue(),
      outputStatus,
      outputType,
      progress: bytesComplete === 0 ? 0 : bytesComplete / bytesTotal,
      warningMessage: warningMessage.stringValue(),
    }
  },
  'VerifyContainer'
)(Verify)
