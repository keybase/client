import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/crypto'
import * as Types from '../../constants/types/crypto'
import * as Container from '../../util/container'
import {getStyle} from '../../common-adapters/text'

type Props = {
  output?: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  textType: Types.TextType
  operation: Types.Operations
  onShowInFinder: (path: string) => void
}

type OutputBarProps = {
  onCopyOutput: (text: string) => void
  onSaveAsText?: () => void
  onShowInFinder: (path: string) => void
  operation: Types.Operations
  output: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
}

type OutputSignedProps = {
  signed: boolean
  signedBy?: string
  operation: Types.Operations
  outputStatus?: Types.OutputStatus
}

type OutputInfoProps = {
  outputStatus?: Types.OutputStatus
  operation: Types.Operations
  children:
    | string
    | React.ReactElement<typeof Kb.BannerParagraph>
    | Array<React.ReactElement<typeof Kb.BannerParagraph>>
}

const largeOutputLimit = 120

export const SignedSender = (props: OutputSignedProps) => {
  const waitingKey = Constants.getStringWaitingKey(props.operation)
  const waiting = Container.useAnyWaiting(waitingKey)
  const canSelfSign =
    props.operation === Constants.Operations.Encrypt || props.operation === Constants.Operations.Sign

  if (!props.outputStatus || (props.outputStatus && props.outputStatus === 'error')) {
    return null
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.signedContainer}>
      <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" style={styles.signedSender}>
        {props.signed && props.signedBy
          ? [
              <Kb.Avatar key="avatar" size={16} username={props.signedBy} />,
              <Kb.Text key="signedBy" type="BodySmall">
                Signed by {canSelfSign ? ' you, ' : ''}
              </Kb.Text>,
              <Kb.ConnectedUsernames
                key="username"
                type="BodySmallBold"
                usernames={[props.signedBy]}
                colorFollowing={true}
                colorYou={true}
              />,
            ]
          : [
              <Kb.Icon key="avatar" type="icon-placeholder-secret-user-16" />,
              canSelfSign ? null : (
                <Kb.Text key="username" type="BodySmallSemibold">
                  Anonymous sender
                </Kb.Text>
              ),
              <Kb.Text key="signedBy" type="BodySmall">
                {canSelfSign ? `Not signed (Sending anonymously)` : `(Not signed)`}
              </Kb.Text>,
            ]}
      </Kb.Box2>
      {waiting && <Kb.ProgressIndicator type="Small" white={false} />}
    </Kb.Box2>
  )
}

export const OutputInfoBanner = (props: OutputInfoProps) => {
  return props.outputStatus && props.outputStatus === 'success' ? (
    <Kb.Banner color="grey" style={styles.banner}>
      {props.children}
    </Kb.Banner>
  ) : null
}

export const OutputBar = (props: OutputBarProps) => {
  const {output, onCopyOutput, onSaveAsText, onShowInFinder} = props
  const waitingKey = Constants.getStringWaitingKey(props.operation)
  const waiting = Container.useAnyWaiting(waitingKey)
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
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outputBarContainer}>
        {props.outputType === 'file' ? (
          <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
            <Kb.Button
              mode="Secondary"
              label={`Open in ${Styles.fileUIName}`}
              onClick={() => onShowInFinder(output)}
            />
          </Kb.ButtonBar>
        ) : (
          <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
            <Kb.Box2 direction="horizontal" ref={attachmentRef}>
              <Kb.Toast position="top center" attachTo={() => attachmentRef.current} visible={showingToast}>
                <Kb.Text type="BodySmall" style={styles.toastText}>
                  Copied to clipboard
                </Kb.Text>
              </Kb.Toast>
              <Kb.Button
                mode="Secondary"
                label="Copy to clipboard"
                disabled={waiting}
                onClick={() => copy()}
              />
            </Kb.Box2>
            {onSaveAsText && (
              <Kb.Button mode="Secondary" label="Save as TXT" onClick={onSaveAsText} disabled={waiting} />
            )}
          </Kb.ButtonBar>
        )}
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
  const waitingKey = Constants.getStringWaitingKey(props.operation)
  const waiting = Container.useAnyWaiting(waitingKey)
  // Output text can be 24 px when output is less that 120 characters
  const outputTextIsLarge =
    props.operation === Constants.Operations.Decrypt || props.operation === Constants.Operations.Verify
  const {fontSize, lineHeight} = getStyle('HeaderBig')
  const outputLargeStyle = outputTextIsLarge &&
    props.output &&
    props.output.length <= largeOutputLimit && {fontSize, lineHeight}

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
            onClick={() => props.output && props.onShowInFinder(props.output)}
          >
            {props.output}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        {props.output &&
          props.output.split('\n').map((line, index) => (
            <Kb.Text
              key={index}
              type={props.textType === 'cipher' ? 'Terminal' : 'Body'}
              selectable={!waiting}
              style={Styles.collapseStyles([styles.output, outputLargeStyle])}
            >
              {line}
            </Kb.Text>
          ))}
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
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny),
        minHeight: 40,
      },
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
        minHeight: Styles.globalMargins.mediumLarge,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      signedIcon: {
        color: Styles.globalColors.green,
      },
      signedSender: {
        ...Styles.globalStyles.flexGrow,
      },
      toastText: {
        color: Styles.globalColors.white,
        textAlign: 'center',
      },
    } as const)
)

export default Output
