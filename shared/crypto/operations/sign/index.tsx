import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import debounce from 'lodash/debounce'
import openURL from '../../../util/open-url'
import {TextInput, FileInput} from '../../input'
import OperationOutput, {OutputBar, OutputInfoBanner, SignedSender} from '../../output'

type Props = {
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onDownloadText: () => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onShowInFinder: (path: string) => void
  output: string
  outputSender?: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
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
          <Kb.Banner color="grey" style={styles.banner}>
            <Kb.Text type="BodySmallSemibold" center={true} style={styles.signInputInfoBanner}>
              Add your cryptographic signature to a message or file.
            </Kb.Text>
          </Kb.Banner>
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
          {props.progress && props.outputStatus && props.outputStatus !== 'success' ? (
            <Kb.ProgressBar ratio={props.progress} style={{width: '100%'}} />
          ) : (
            <Kb.Divider />
          )}
          <Kb.Box2 direction="vertical" fullHeight={true}>
            <OutputInfoBanner operation={Constants.Operations.Encrypt} outputStatus={props.outputStatus}>
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
            <SignedSender
              signed={true}
              signedBy={props.outputSender}
              operation={Constants.Operations.Sign}
              outputStatus={props.outputStatus}
            />
            <OperationOutput
              outputStatus={props.outputStatus}
              output={props.output}
              outputType={props.outputType}
              textType="cipher"
              operation={Constants.Operations.Sign}
              onShowInFinder={props.onShowInFinder}
            />
            <OutputBar
              operation={Constants.Operations.Sign}
              output={props.output}
              outputStatus={props.outputStatus}
              outputType={props.outputType}
              onCopyOutput={props.onCopyOutput}
              onDownloadText={props.onDownloadText}
              onShowInFinder={props.onShowInFinder}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.DragAndDrop>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny),
        minHeight: 40,
      },
      signInputInfoBanner: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
    } as const)
)

export default Sign
