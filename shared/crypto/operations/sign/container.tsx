import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as FSGen from '../../../actions/fs-gen'
import Sign from '.'

const operation = 'sign'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    input: state.crypto.sign.input,
    inputType: state.crypto.sign.inputType,
    output: state.crypto.sign.output,
    outputStatus: state.crypto.sign.outputStatus,
    outputType: state.crypto.sign.outputType,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: inputValue})),
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
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
  }),
  'SignContainer'
)(Sign)
