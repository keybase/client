import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import HiddenString from '../../../util/hidden-string'
import Sign from '.'

const operation = 'sign'

export default Container.namedConnect(
  (state: Container.TypedState) => ({_sign: state.crypto.sign}),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSaveAsText: () => dispatch(CryptoGen.createDownloadSignedText()),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: new HiddenString(inputValue)})),
    onShowInFinder: (path: string) =>
      dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: path})),
  }),
  (stateProps, dispatchProps) => {
    const {_sign} = stateProps
    const {bytesComplete, bytesTotal, inputType, errorMessage, input, warningMessage} = _sign
    const {output, outputSender, outputStatus, outputType, outputMatchesInput} = _sign
    const {onClearInput, onCopyOutput, onSaveAsText} = dispatchProps
    return {
      errorMessage: errorMessage.stringValue(),
      input: input.stringValue(),
      inputType,
      onClearInput,
      onCopyOutput,
      onSaveAsText,
      onSetInput: dispatchProps.onSetInput,
      onShowInFinder: dispatchProps.onShowInFinder,
      output: output.stringValue(),
      outputMatchesInput,
      outputSender: outputSender?.stringValue(),
      outputStatus,
      outputType,
      progress: bytesComplete === 0 ? 0 : bytesComplete / bytesTotal,
      warningMessage: warningMessage.stringValue(),
    }
  },
  'SignContainer'
)(Sign)
