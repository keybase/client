import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import debounce from 'lodash/debounce'
import openURL from '../../../util/open-url'
import {TextInput, FileInput, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, OutputInfoBanner, SignedSender, OutputProgress} from '../../output'

type Props = {
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onSaveAsText: () => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onShowInFinder: (path: string) => void
  outputMatchesInput: boolean
  output: string
  outputSender?: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
  errorMessage: string
  warningMessage: string
}

// We want to debuonce the onChangeText callback for our input so we are not sending an RPC on every keystroke
const debounced = debounce((fn, ...args) => fn(...args), 100)

const Sign = (props: Props) => {
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
        prompt="Drop a file to sign"
      >
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <OperationBanner
            operation={Constants.Operations.Sign}
            infoMessage="Add your cryptographic signature to a message or file."
          />
          {props.inputType === 'file' ? (
            <FileInput
              path={props.input}
              onClearFiles={() => {
                setInputValue('')
                props.onClearInput()
              }}
              operation={Constants.Operations.Sign}
            />
          ) : (
            <TextInput
              value={inputValue}
              placeholder="Enter text, drop a file, or"
              textType="plain"
              operation={Constants.Operations.Sign}
              onSetFile={path => {
                props.onSetInput('file', path)
              }}
              onChangeText={text => {
                setInputValue(text)
                debounced(props.onSetInput, 'text', text)
              }}
            />
          )}
          <OutputProgress operation={Constants.Operations.Sign} />
          <Kb.Box2 direction="vertical" fullHeight={true}>
            <OutputInfoBanner operation={Constants.Operations.Sign}>
              <Kb.Text type="BodySmallSemibold" center={true}>
                This is your signed {props.outputType === 'file' ? 'file' : 'message'}, using{` `}
                <Kb.Text
                  type="BodySecondaryLink"
                  underline={true}
                  onClick={() => openURL(Constants.saltpackDocumentation)}
                >
                  Saltpack
                </Kb.Text>
                .{` `}Anyone who has it can verify you signed it.
              </Kb.Text>
            </OutputInfoBanner>
            <SignedSender operation={Constants.Operations.Sign} />
            <OperationOutput operation={Constants.Operations.Sign} />
            <OutputBar operation={Constants.Operations.Sign} />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.DragAndDrop>
    </Kb.Box2>
  )
}

export default Sign
