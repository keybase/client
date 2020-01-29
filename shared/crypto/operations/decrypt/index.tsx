import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import debounce from 'lodash/debounce'
import {TextInput, FileInput, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, SignedSender, OutputProgress} from '../../output'

type Props = {
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onShowInFinder: (path: string) => void
  output: string
  outputSender?: string
  outputSigned: boolean
  outputMatchesInput: boolean
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
  username?: string
  errorMessage: string
  warningMessage: string
}

// We want to debuonce the onChangeText callback for our input so we are not sending an RPC on every keystroke
const debounced = debounce((fn, ...args) => fn(...args), 500)

const Decrypt = (props: Props) => {
  const [inputValue, setInputValue] = React.useState(props.input)
  const onAttach = (localPaths: Array<string>) => {
    // Drag and drop allows for multi-file upload, we only want one file upload
    setInputValue('')
    props.onSetInput('file', localPaths[0])
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.DragAndDrop
        allowFolders={true}
        fullHeight={true}
        fullWidth={true}
        onAttach={onAttach}
        prompt="Drop a file to decrypt"
      >
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <OperationBanner operation={Constants.Operations.Decrypt} />
          {props.inputType === 'file' ? (
            <FileInput
              path={props.input}
              onClearFiles={() => {
                setInputValue('')
                props.onClearInput()
              }}
              operation={Constants.Operations.Decrypt}
            />
          ) : (
            <TextInput
              value={inputValue}
              placeholder="Enter ciphertext, drop an encrypted file, or"
              textType="cipher"
              operation={Constants.Operations.Decrypt}
              onSetFile={path => {
                props.onSetInput('file', path)
              }}
              onChangeText={text => {
                setInputValue(text)
                debounced(props.onSetInput, 'text', text)
              }}
            />
          )}
          <OutputProgress operation={Constants.Operations.Decrypt} />
          <Kb.Box2 direction="vertical" fullHeight={true}>
            <SignedSender operation={Constants.Operations.Decrypt} />
            <OperationOutput operation={Constants.Operations.Decrypt} />
            <OutputBar operation={Constants.Operations.Decrypt} />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.DragAndDrop>
    </Kb.Box2>
  )
}

export default Decrypt
