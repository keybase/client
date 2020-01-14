import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import debounce from 'lodash/debounce'
import {TextInput, FileInput} from '../../input'
import OperationOutput, {OutputBar, SignedSender} from '../../output'
import Recipients from '../../recipients/container'

type Props = {
  input: string
  inputType: Types.InputTypes
  noIncludeSelf: boolean
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onShowInFinder: (path: string) => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onSetOptions: (options: Types.EncryptOptions) => void
  options: Types.EncryptOptions
  hasRecipients: boolean
  output: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  username?: string
}

type EncryptOptionsProps = {
  hasRecipients: boolean
  noIncludeSelf: boolean
  onSetOptions: (options: Types.EncryptOptions) => void
  options: Types.EncryptOptions
}

// We want to debuonce the onChangeText callback for our input so we are not sending an RPC on every keystroke
const debounced = debounce((fn, ...args) => fn(...args), 100)

const EncryptOptions = (props: EncryptOptionsProps) => {
  const {hasRecipients, noIncludeSelf, onSetOptions, options} = props
  const {includeSelf, sign} = options
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="medium" style={styles.optionsContainer}>
      {noIncludeSelf ? null : (
        <Kb.Checkbox
          label="Include yourself"
          disabled={!hasRecipients}
          checked={includeSelf}
          onCheck={newValue => onSetOptions({includeSelf: newValue, sign})}
        />
      )}
      <Kb.Checkbox
        label="Sign"
        disabled={!hasRecipients}
        checked={sign}
        onCheck={newValue => onSetOptions({includeSelf, sign: newValue})}
      />
    </Kb.Box2>
  )
}

const Encrypt = (props: Props) => {
  const [inputValue, setInputValue] = React.useState(props.input)
  const onAttach = (localPaths: Array<string>) => {
    props.onSetInput('file', localPaths[0])
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.DragAndDrop
        allowFolders={false}
        fullHeight={true}
        fullWidth={true}
        onAttach={onAttach}
        prompt="Drop a file to encrypt"
      >
        <Recipients operation="encrypt" />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          {props.inputType === 'file' ? (
            <FileInput
              path={props.input}
              operation={Constants.Operations.Encrypt}
              onClearFiles={props.onClearInput}
            />
          ) : (
            <TextInput
              value={inputValue}
              placeholder="Write, paste, or drop a file you want to encrypt"
              operation={Constants.Operations.Encrypt}
              textType="plain"
              onSetFile={path => {
                props.onSetInput('file', path)
              }}
              onChangeText={text => {
                setInputValue(text)
                // props.onSetInput('text', text)
                debounced(props.onSetInput, 'text', text)
              }}
            />
          )}
          <EncryptOptions
            hasRecipients={props.hasRecipients}
            noIncludeSelf={props.noIncludeSelf}
            options={props.options}
            onSetOptions={props.onSetOptions}
          />
          <Kb.Divider />
          <Kb.Box2 direction="vertical" fullHeight={true}>
            <SignedSender
              signed={props.options.sign}
              signedBy={props.username}
              outputStatus={props.outputStatus}
            />
            <OperationOutput
              outputStatus={props.outputStatus}
              output={props.output}
              outputType={props.outputType}
              textType="cipher"
              operation={Constants.Operations.Encrypt}
              onShowInFinder={props.onShowInFinder}
            />
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      coverOutput: {
        ...Styles.globalStyles.flexBoxCenter,
      },
      optionsContainer: {
        ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small),
        alignItems: 'center',
        height: 40,
      },
      outputPlaceholder: {
        backgroundColor: Styles.globalColors.blueGreyLight,
      },
      questionMark: {
        color: Styles.globalColors.black_20,
      },
      questionMarkContainer: {
        marginLeft: Styles.globalMargins.xtiny,
        marginTop: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default Encrypt
