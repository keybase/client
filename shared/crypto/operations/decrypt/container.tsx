import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import Decrypt from '.'

const operation = 'decrypt'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    input: state.crypto.decrypt.input,
    inputType: state.crypto.decrypt.inputType,
    output: state.crypto.decrypt.output,
    outputStatus: state.crypto.decrypt.outputStatus,
    outputType: state.crypto.decrypt.outputType,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: inputValue})),
  }),
  (stateProps, dispatchProps) => ({
    input: stateProps.input,
    inputType: stateProps.inputType,
    onClearInput: dispatchProps.onClearInput,
    onCopyOutput: dispatchProps.onCopyOutput,
    onSetInput: dispatchProps.onSetInput,
    output: stateProps.output,
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
  }),
  'DecryptContainer'
)(Decrypt)
