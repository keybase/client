import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import HiddenString from '../../../util/hidden-string'
import Decrypt from '.'

const operation = 'decrypt'

export default Container.namedConnect(
  (state: Container.TypedState) => ({_decrypt: state.crypto.decrypt}),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => {
    const {_decrypt} = stateProps
    const {bytesComplete, bytesTotal, errorMessage, input, inputType, warningMessage} = _decrypt
    const {output, outputSender, outputSigned, outputStatus, outputType, outputMatchesInput} = _decrypt
    const {onClearInput, onCopyOutput, onSetInput, onShowInFinder} = dispatchProps
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
      outputSigned,
      outputStatus,
      outputType,
      progress: bytesComplete === 0 ? 0 : bytesComplete / bytesTotal,
      warningMessage: warningMessage.stringValue(),
    }
  },
  'DecryptContainer'
)(Decrypt)
