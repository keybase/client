import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import debounce from 'lodash/debounce'
import {TextInput, FileInput} from '../../input'
import OperationOutput, {OutputBar, OutputSigned} from '../../output'

type Props = {
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onShowInFinder: (path: string) => void
  output: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  username?: string
}

// We want to debuonce the onChangeText callback for our input so we are not sending an RPC on every keystroke
const debounced = debounce((fn, ...args) => fn(...args), 500)

const Decrypt = (props: Props) => {
  const [inputValue, setInputValue] = React.useState(props.input)
  const onAttach = (localPaths: Array<string>) => {
    // Drag and drop allows for multi-file upload, we only want one file upload
    props.onSetInput('file', localPaths[0])
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.DragAndDrop allowFolders={true} fullHeight={true} fullWidth={true} onAttach={onAttach}>
        <Kb.Box2 direction="vertical" fullHeight={true}>
          {props.inputType === 'file' ? (
            <FileInput
              path={props.input}
              onClearFiles={props.onClearInput}
              operation={Constants.Operations.Decrypt}
            />
          ) : (
            <TextInput
              value={inputValue}
              placeholder="Paste cipher text or drop an encrypted file"
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
          <Kb.Divider />

          <Kb.Box2 direction="vertical" fullHeight={true}>
            <OperationOutput
              outputStatus={props.outputStatus}
              output={props.output}
              outputType={props.outputType}
              textType="plain"
              operation={Constants.Operations.Decrypt}
              onShowInFinder={props.onShowInFinder}
            />
            <OutputSigned signed={true} signedBy="cecileb" outputStatus={props.outputStatus} />
            <OutputBar
              output={props.output}
              outputStatus={props.outputStatus}
              outputType={props.outputType}
              onCopyOutput={props.onCopyOutput}
              onShowInFinder={props.onShowInFinder}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.DragAndDrop>
    </Kb.Box2>
  )
}

export default Decrypt
