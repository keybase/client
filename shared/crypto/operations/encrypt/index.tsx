import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import openURL from '../../../util/open-url'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, OutputInfoBanner, SignedSender, OutputProgress} from '../../output'
import Recipients from '../../recipients/container'

type Props = {
  input: string
  inputType: Types.InputTypes
  hideIncludeSelf: boolean
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onSaveAsText: () => void
  onShowInFinder: (path: string) => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onSetOptions: (options: Types.EncryptOptions) => void
  options: Types.EncryptOptions
  outputMatchesInput: boolean
  hasRecipients: boolean
  hasSBS: boolean
  output: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
  recipients: Array<string>
  username?: string
  errorMessage: string
  warningMessage: string
}

type EncryptOptionsProps = {
  hasRecipients: boolean
  hasSBS: boolean
  hideIncludeSelf: boolean
  onSetOptions: (options: Types.EncryptOptions) => void
  options: Types.EncryptOptions
}

const EncryptOptions = React.memo((props: EncryptOptionsProps) => {
  const {hasRecipients, hasSBS, hideIncludeSelf, onSetOptions, options} = props
  const {includeSelf, sign} = options
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="medium" style={styles.optionsContainer}>
      {hideIncludeSelf ? null : (
        <Kb.Checkbox
          label="Include yourself"
          disabled={hasSBS || !hasRecipients}
          checked={hasSBS || includeSelf}
          onCheck={newValue => onSetOptions({includeSelf: newValue, sign})}
        />
      )}
      <Kb.Checkbox
        label="Sign"
        disabled={hasSBS}
        checked={sign}
        onCheck={newValue => onSetOptions({includeSelf, sign: newValue})}
      />
    </Kb.Box2>
  )
})

const Encrypt = (props: Props) => {
  const [fileDroppedCounter, setFileDroppedCounter] = React.useState(0)
  const youAnd = (who: string) => (props.options.includeSelf ? `you and ${who}` : who)
  const whoCanRead = props.hasRecipients
    ? ` Only ${
        props.recipients?.length > 1 ? youAnd('your recipients') : youAnd(props.recipients[0])
      } can decipher it.`
    : ''
  return (
    <DragAndDrop
      operation={Constants.Operations.Encrypt}
      prompt="Drop a file to encrypt"
      onClearInput={() => setFileDroppedCounter(prevCount => prevCount + 1)}
    >
      <OperationBanner
        operation={Constants.Operations.Encrypt}
        infoMessage="Encrypt to anyone, even if they're not on Keybase yet."
      />
      <Recipients operation="encrypt" />
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <Input operation={Constants.Operations.Encrypt} fileDroppedCounter={fileDroppedCounter} />
        <EncryptOptions
          hasRecipients={props.hasRecipients}
          hasSBS={props.hasSBS}
          hideIncludeSelf={props.hideIncludeSelf}
          options={props.options}
          onSetOptions={props.onSetOptions}
        />
        <OutputProgress operation={Constants.Operations.Encrypt} />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <OutputInfoBanner operation={Constants.Operations.Encrypt}>
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
          <SignedSender operation={Constants.Operations.Encrypt} />
          <OperationOutput operation={Constants.Operations.Encrypt} />
          <OutputBar operation={Constants.Operations.Encrypt} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
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
