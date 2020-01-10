import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/crypto'
import * as Types from '../../constants/types/crypto'

type Props = {
  output?: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  textType: Types.TextType
  operation: Types.Operations
}

type OutputBarProps = {
  output: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  onCopyOutput: (text: string) => void
}

type OutputSignedProps = {
  signed: boolean
  signedBy?: string
  outputStatus?: Types.OutputStatus
}

export const OutputSigned = (props: OutputSignedProps) => {
  return props.outputStatus && props.outputStatus === 'success' ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.signedContainer}>
      {props.signed && props.signedBy ? (
        <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center">
          <Kb.Icon type="iconfont-success" sizeType="Small" style={styles.signedIcon} />
          <Kb.Text type="BodySmallSuccess">Signed by</Kb.Text>
          <Kb.ConnectedUsernames type="BodySmallBold" colorYou={true} usernames={[props.signedBy]} />
        </Kb.Box2>
      ) : (
        <Kb.Text type="BodySmall">Not signed (anonymous sender)</Kb.Text>
      )}
    </Kb.Box2>
  ) : (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      fullHeight={true}
      style={Styles.collapseStyles([styles.signedContainer, styles.outputPlaceholder, {maxHeight: 34}])}
    ></Kb.Box2>
  )
}

export const OutputBar = (props: OutputBarProps) => {
  const {output, onCopyOutput} = props
  const attachmentRef = React.useRef<Kb.Box2>(null)
  const [showingToast, setShowingToast] = React.useState(false)
  const setHideToastTimeout = Kb.useTimeout(() => setShowingToast(false), 1500)
  React.useEffect(() => {
    showingToast && setHideToastTimeout()
  }, [showingToast, setHideToastTimeout])
  const copy = React.useCallback(() => {
    if (!output) return
    setShowingToast(true)
    onCopyOutput(output)
  }, [output, onCopyOutput])
  return props.outputStatus && props.outputStatus === 'success' ? (
    <>
      <Kb.Divider />
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outputBarContainer}>
        <Kb.ButtonBar direction="row" style={styles.buttonBar}>
          <Kb.Button
            mode={props.outputType === 'file' ? 'Primary' : 'Secondary'}
            label="Download file"
            fullWidth={true}
          />
          {props.outputType !== 'file' && (
            <Kb.Box2 direction="horizontal" fullWidth={true} ref={attachmentRef}>
              <Kb.Toast position="top center" attachTo={() => attachmentRef.current} visible={showingToast}>
                <Kb.Text type="BodySmall" style={styles.toastText}>
                  Copied to clipboard
                </Kb.Text>
              </Kb.Toast>
              <Kb.Button mode="Primary" label="Copy to clipboard" fullWidth={true} onClick={() => copy()} />
            </Kb.Box2>
          )}
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  ) : (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([styles.outputBarContainer, styles.outputPlaceholder])}
    >
      <Kb.ButtonBar direction="row" style={styles.buttonBar}>
        {null}
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const Output = (props: Props) => {
  const fileOutputTextColor =
    props.textType === 'cipher' ? Styles.globalColors.greenDark : Styles.globalColors.black
  const fileIcon = Constants.getOutputFileIcon(props.operation)
  return props.outputStatus && props.outputStatus === 'success' ? (
    props.outputType === 'file' ? (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          style={styles.fileOutputContainer}
        >
          <Kb.Icon type={fileIcon} sizeType="Huge" />
          <Kb.Text
            type="BodyPrimaryLink"
            style={Styles.collapseStyles([styles.fileOutputText, {color: fileOutputTextColor}])}
          >
            {props.output}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        {props.output && (
          <Kb.Text type={props.textType === 'cipher' ? 'Terminal' : 'Body'} style={styles.output}>
            {props.output}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  ) : (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={Styles.collapseStyles([styles.coverOutput, styles.outputPlaceholder])}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        height: Styles.globalMargins.large,
        minHeight: Styles.globalMargins.large,
      },
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexGrow,
          ...Styles.padding(Styles.globalMargins.tiny),
          overflowY: 'auto',
        },
      }),
      coverOutput: {
        ...Styles.globalStyles.flexBoxCenter,
      },
      fileOutputContainer: {
        ...Styles.padding(Styles.globalMargins.xsmall),
      },
      fileOutputText: {
        ...Styles.globalStyles.fontSemibold,
      },
      output: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
        },
        isElectron: {
          wordBreak: 'break-word',
        },
      }),
      outputBarContainer: {
        ...Styles.padding(Styles.globalMargins.tiny),
      },
      outputPlaceholder: {
        backgroundColor: Styles.globalColors.blueGreyLight,
      },
      outputVerifiedContainer: {
        marginBottom: Styles.globalMargins.xlarge,
      },
      placeholder: {
        color: Styles.globalColors.black_50,
      },
      signedContainer: {
        ...Styles.padding(Styles.globalMargins.tiny),
      },
      signedIcon: {
        color: Styles.globalColors.green,
      },
      toastText: {
        color: Styles.globalColors.white,
        textAlign: 'center',
      },
    } as const)
)

export default Output
