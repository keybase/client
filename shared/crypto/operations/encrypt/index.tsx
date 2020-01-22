import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import debounce from 'lodash/debounce'
import openURL from '../../../util/open-url'
import {TextInput, FileInput} from '../../input'
import OperationOutput, {OutputBar, OutputInfoBanner, SignedSender} from '../../output'
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
  hasSBS: boolean
  output: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
  recipients: Array<string>
  username?: string
}

type EncryptOptionsProps = {
  hasRecipients: boolean
  hasSBS: boolean
  noIncludeSelf: boolean
  onSetOptions: (options: Types.EncryptOptions) => void
  options: Types.EncryptOptions
}

// We want to debuonce the onChangeText callback for our input so we are not sending an RPC on every keystroke
const debounced = debounce((fn, ...args) => fn(...args), 100)

const EncryptOptions = (props: EncryptOptionsProps) => {
  const {hasRecipients, hasSBS, noIncludeSelf, onSetOptions, options} = props
  const {includeSelf, sign} = options
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="medium" style={styles.optionsContainer}>
      {noIncludeSelf ? null : (
        <Kb.Checkbox
          label="Include yourself"
          disabled={hasSBS || !hasRecipients}
          checked={hasSBS || includeSelf}
          onCheck={newValue => onSetOptions({includeSelf: newValue, sign})}
        />
      )}
      <Kb.Checkbox
        label="Sign"
        checked={sign}
        onCheck={newValue => onSetOptions({includeSelf, sign: newValue})}
      />
    </Kb.Box2>
  )
}

const Encrypt = (props: Props) => {
  const [inputValue, setInputValue] = React.useState(props.input)
  const onAttach = (localPaths: Array<string>) => {
    // Drag and drop allows for multi-file upload, we only want one file upload
    setInputValue('')
    props.onSetInput('file', localPaths[0])
  }
  const youAnd = (who: string) => (props.options.includeSelf ? `you and ${who}` : who)
  const whoCanRead = props.hasRecipients
    ? ` Only ${
        props.recipients?.length > 1 ? youAnd('your recipients') : youAnd(props.recipients[0])
      } can decipher it.`
    : ''
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.DragAndDrop
        allowFolders={false}
        fullHeight={true}
        fullWidth={true}
        onAttach={onAttach}
        prompt="Drop a file to encrypt"
      >
        <Kb.Banner color="grey">
          <Kb.BannerParagraph
            bannerColor="grey"
            content="Encrypt to anyone, even if they're not on Keybase yet."
          />
        </Kb.Banner>
        <Recipients operation="encrypt" />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          {props.inputType === 'file' ? (
            <FileInput
              path={props.input}
              operation={Constants.Operations.Encrypt}
              onClearFiles={() => {
                setInputValue('')
                props.onClearInput()
              }}
            />
          ) : (
            <TextInput
              value={inputValue}
              textType="plain"
              placeholder="Enter text, drop a file, or"
              operation={Constants.Operations.Encrypt}
              onSetFile={path => {
                props.onSetInput('file', path)
              }}
              onChangeText={text => {
                setInputValue(text)
                debounced(props.onSetInput, 'text', text)
              }}
            />
          )}
          <EncryptOptions
            hasRecipients={props.hasRecipients}
            hasSBS={props.hasSBS}
            noIncludeSelf={props.noIncludeSelf}
            options={props.options}
            onSetOptions={props.onSetOptions}
          />
          <Kb.ProgressBar ratio={props.progress} style={{width: '100%'}} />
          <Kb.Box2 direction="vertical" fullHeight={true}>
            <OutputInfoBanner operation={Constants.Operations.Encrypt} outputStatus={props.outputStatus}>
              <Kb.BannerParagraph
                bannerColor="grey"
                content={[
                  `This is your encrypted ${props.outputType === 'file' ? 'file' : 'message'}, using `,
                  {
                    onClick: () => openURL(Constants.saltpackDocumentation),
                    text: 'Saltpack',
                  },
                  '.',
                  props.outputType == 'text' ? " It's also called ciphertext." : '',
                ]}
              />
              <Kb.BannerParagraph
                bannerColor="grey"
                content={[props.hasRecipients ? ' Share it however you like.' : null, whoCanRead]}
              />
            </OutputInfoBanner>
            <SignedSender
              signed={props.options.sign}
              signedBy={props.username}
              operation={Constants.Operations.Encrypt}
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
              operation={Constants.Operations.Encrypt}
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
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny),
        minHeight: 40,
      },
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
