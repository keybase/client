import * as React from 'react'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import debounce from 'lodash/debounce'
import {TextInput, FileInput} from '../../input'
import OperationOutput, {OutputBar, OutputSigned} from '../../output'
import Recipients from '../../recipients/container'

type Props = {
  canUsePGP: boolean
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
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
  options: Types.EncryptOptions
  hasRecipients: boolean
  canUsePGP: boolean
  onSetOptions: (options: Types.EncryptOptions) => void
}

// We want to debuonce the onChangeText callback for our input so we are not sending an RPC on every keystroke
const debounced = debounce((fn, ...args) => fn(...args), 500)

const EncryptOptions = (props: EncryptOptionsProps) => {
  const {onSetOptions, options, hasRecipients} = props
  const {includeSelf, sign} = options
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="medium" style={styles.optionsContainer}>
      <Kb.Checkbox
        label="Include yourself"
        disabled={!hasRecipients}
        checked={includeSelf}
        onCheck={newValue => onSetOptions({includeSelf: newValue, sign})}
      />
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
      <Kb.DragAndDrop allowFolders={false} fullHeight={true} fullWidth={true} onAttach={onAttach}>
        <Recipients operation="encrypt" />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          {props.inputType === 'file' ? (
            <FileInput path={props.input} onClearFiles={props.onClearInput} />
          ) : (
            <TextInput
              value={inputValue}
              textType="plain"
              placeholder="Write something or drop a file you want to encrypt"
              onChangeText={text => {
                setInputValue(text)
                debounced(props.onSetInput, 'text', text)
              }}
            />
          )}
          <Kb.Divider />
          <EncryptOptions
            hasRecipients={props.hasRecipients}
            options={props.options}
            canUsePGP={props.canUsePGP}
            onSetOptions={props.onSetOptions}
          />
          <Kb.Divider />
          <Kb.Box2 direction="vertical" fullHeight={true}>
            <OperationOutput
              outputStatus={props.outputStatus}
              output={props.output}
              outputType={props.outputType}
              textType="cipher"
            />
            <OutputSigned
              signed={props.options.sign}
              signedBy={props.username}
              outputStatus={props.outputStatus}
            />
            <OutputBar
              output={props.output}
              outputStatus={props.outputStatus}
              outputType={props.outputType}
              onCopyOutput={props.onCopyOutput}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.DragAndDrop>
    </Kb.Box2>
  )
}

export const Placeholder = (
  <>
    <Kb.Icon type="iconfont-lock" sizeType="Big" />
    <Kb.Text type="BodySemibold">Your encrypted message will appear here</Kb.Text>
  </>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      coverOutput: {
        ...Styles.globalStyles.flexBoxCenter,
      },
      optionsContainer: {
        ...Styles.padding(Styles.globalMargins.tiny),
        alignItems: 'center',
        height: Styles.globalMargins.xlarge,
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
