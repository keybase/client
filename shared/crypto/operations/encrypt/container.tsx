import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as ConfigGen from '../../../actions/config-gen'
import Encrypt from '.'

const operation = 'encrypt'

export default Container.namedConnect(
  (state: Container.TypedState) => ({
    hasRecipients: state.crypto.encrypt.meta.hasRecipients,
    input: state.crypto.encrypt.input,
    inputType: state.crypto.encrypt.inputType,
    options: state.crypto.encrypt.options,
    output: state.crypto.encrypt.output,
    outputStatus: state.crypto.encrypt.outputStatus,
    outputType: state.crypto.encrypt.outputType,
    username: state.config.username,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onClearInput: () => dispatch(CryptoGen.createClearInput({operation})),
    onCopyOutput: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onSetInput: (inputType: Types.InputTypes, inputValue: string) =>
      dispatch(CryptoGen.createSetInput({operation, type: inputType, value: inputValue})),
    onSetOptions: (options: Types.EncryptOptions) => dispatch(CryptoGen.createSetEncryptOptions({options})),
  }),
  (stateProps, dispatchProps) => ({
    hasRecipients: stateProps.hasRecipients,
    input: stateProps.input,
    inputType: stateProps.inputType,
    onClearInput: dispatchProps.onClearInput,
    onCopyOutput: dispatchProps.onCopyOutput,
    onSetInput: dispatchProps.onSetInput,
    onSetOptions: dispatchProps.onSetOptions,
    options: stateProps.options,
    output: stateProps.output,
    outputStatus: stateProps.outputStatus,
    outputType: stateProps.outputType,
    username: stateProps.username,
  }),
  'EncryptContainer'
)(Encrypt)
