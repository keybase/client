import * as React from 'react'
import * as Constants from '../../constants/crypto'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/crypto'
import * as FSGen from '../../actions/fs-gen'
import * as ConfigGen from '../../actions/config-gen'
import * as CryptoGen from '../../actions/crypto-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Platforms from '../../constants/platform'
import {humanizeBytes} from '../../constants/fs'
import capitalize from 'lodash/capitalize'
import {getStyle} from '../../common-adapters/text'

const {electron, path: nodePath} = KB
const {showOpenDialog} = electron.dialog
const {dirname} = nodePath

type OutputProps = {
  operation: Types.Operations
}

type OutputBarProps = {
  operation: Types.Operations
}

type SignedSenderProps = {
  operation: Types.Operations
}

type OutputProgressProps = {
  operation: Types.Operations
}

type OutputInfoProps = {
  operation: Types.Operations
  children:
    | string
    | React.ReactElement<typeof Kb.BannerParagraph>
    | Array<React.ReactElement<typeof Kb.BannerParagraph>>
}

const largeOutputLimit = 120

export const SignedSender = (props: SignedSenderProps) => {
  const {operation} = props

  const waitingKey = Constants.getStringWaitingKey(operation)
  const waiting = Container.useAnyWaiting(waitingKey)

  const signed = Container.useSelector(state => state.crypto[operation].outputSigned)
  const signedByUsername = Container.useSelector(state => state.crypto[operation].outputSenderUsername)
  const signedByFullname = Container.useSelector(state => state.crypto[operation].outputSenderFullname)
  const outputStatus = Container.useSelector(state => state.crypto[operation].outputStatus)

  const isSelfSigned = operation === Constants.Operations.Encrypt || operation === Constants.Operations.Sign
  const avatarSize = isSelfSigned ? 16 : 48
  const usernameType = isSelfSigned ? 'BodySmallBold' : 'BodyBold'

  if (!outputStatus || (outputStatus && outputStatus === 'error')) {
    return null
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.signedContainer}>
      {signed && signedByUsername ? (
        <Kb.Box2
          direction="horizontal"
          gap={isSelfSigned ? 'xtiny' : 'xsmall'}
          alignItems="center"
          style={styles.signedSender}
        >
          <Kb.Avatar key="avatar" size={avatarSize} username={signedByUsername.stringValue()} />

          {isSelfSigned ? (
            [
              <Kb.Text key="signedByUsername" type="BodySmall">
                Signed by {isSelfSigned ? ' you, ' : ''}
              </Kb.Text>,
              <Kb.ConnectedUsernames
                key="username"
                type={usernameType}
                usernames={[signedByUsername.stringValue()]}
                colorFollowing={true}
                colorYou={true}
              />,
            ]
          ) : (
            <Kb.Box2 key="signedByUsername" direction="vertical">
              <Kb.ConnectedUsernames
                type={usernameType}
                usernames={[signedByUsername.stringValue()]}
                colorFollowing={true}
                colorYou={true}
              />
              {signedByFullname && <Kb.Text type="BodySmall">{signedByFullname.stringValue()}</Kb.Text>}
            </Kb.Box2>
          )}
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" style={styles.signedSender}>
          <Kb.Icon key="avatar" type="icon-placeholder-secret-user-16" />
          {isSelfSigned ? null : (
            <Kb.Text key="username" type="BodySmallSemibold">
              Anonymous sender
            </Kb.Text>
          )}
          <Kb.Text key="signedByUsername" type="BodySmall">
            {isSelfSigned ? `Not signed (Sending anonymously)` : `(Not signed)`}
          </Kb.Text>
        </Kb.Box2>
      )}
      {waiting && <Kb.ProgressIndicator type="Small" white={false} />}
    </Kb.Box2>
  )
}

export const OutputProgress = (props: OutputProgressProps) => {
  const {operation} = props

  const bytesTotal = Container.useSelector(state => state.crypto[operation].bytesTotal)
  const bytesComplete = Container.useSelector(state => state.crypto[operation].bytesComplete)
  const inProgress = Container.useSelector(state => state.crypto[operation].inProgress)

  const ratio = bytesComplete === 0 ? 0 : bytesComplete / bytesTotal

  return inProgress ? (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
      <Kb.ProgressBar ratio={ratio} style={styles.progressBar} />
      <Kb.Text type="Body">{`${humanizeBytes(bytesComplete, 1)} / ${humanizeBytes(bytesTotal, 1)}`}</Kb.Text>
    </Kb.Box2>
  ) : null
}

export const OutputInfoBanner = (props: OutputInfoProps) => {
  const {operation} = props
  const outputStatus = Container.useSelector(state => state.crypto[operation].outputStatus)
  return outputStatus && outputStatus === 'success' ? (
    <Kb.Banner color="grey" style={styles.banner}>
      {props.children}
    </Kb.Banner>
  ) : null
}

export const OutputBar = (props: OutputBarProps) => {
  const {operation} = props
  const dispatch = Container.useDispatch()
  const canSaveAsText = operation === Constants.Operations.Encrypt || operation === Constants.Operations.Sign
  const canReplyInChat =
    operation === Constants.Operations.Decrypt || operation === Constants.Operations.Verify

  const waitingKey = Constants.getStringWaitingKey(props.operation)
  const waiting = Container.useAnyWaiting(waitingKey)

  const output = Container.useSelector(state => state.crypto[operation].output.stringValue())
  const outputValid = Container.useSelector(state => state.crypto[operation].outputValid)
  const outputStatus = Container.useSelector(state => state.crypto[operation].outputStatus)
  const outputType = Container.useSelector(state => state.crypto[operation].outputType)
  const signed = Container.useSelector(state => state.crypto[operation].outputSigned)
  const signedByUsername = Container.useSelector(state => state.crypto[operation].outputSenderUsername)
  const actionsDisabled = waiting || !outputValid

  const onShowInFinder = () => {
    dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: output}))
  }

  const onReplyInChat = (username: Container.HiddenString) => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username.stringValue()], reason: 'search'}))
  }

  const onCopyOutput = () => {
    dispatch(ConfigGen.createCopyToClipboard({text: output}))
  }

  const onSaveAsText = () => {
    if (operation === Constants.Operations.Sign) {
      return dispatch(CryptoGen.createDownloadSignedText())
    }

    if (operation === Constants.Operations.Encrypt) {
      return dispatch(CryptoGen.createDownloadEncryptedText())
    }
  }

  const attachmentRef = React.useRef<Kb.Box2>(null)
  const [showingToast, setShowingToast] = React.useState(false)

  const setHideToastTimeout = Kb.useTimeout(() => setShowingToast(false), 1500)

  const copy = () => {
    if (!output) return
    setShowingToast(true)
    onCopyOutput()
  }

  // Start timeout to clear toast if currently displayed
  React.useEffect(() => {
    showingToast && setHideToastTimeout()
  }, [showingToast, setHideToastTimeout])

  return outputStatus && outputStatus === 'success' ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outputBarContainer}>
      {outputType === 'file' ? (
        <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
          <Kb.Button
            mode="Secondary"
            label={`Open in ${Styles.fileUIName}`}
            onClick={() => onShowInFinder()}
          />
        </Kb.ButtonBar>
      ) : (
        <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
          {canReplyInChat && signed && signedByUsername && (
            <Kb.Button
              mode="Primary"
              label="Reply in chat"
              onClick={() => onReplyInChat(signedByUsername)}
              disabled={actionsDisabled}
            />
          )}
          <Kb.Box2 direction="horizontal" ref={attachmentRef}>
            <Kb.Toast position="top center" attachTo={() => attachmentRef.current} visible={showingToast}>
              <Kb.Text type="BodySmall" style={styles.toastText}>
                Copied to clipboard
              </Kb.Text>
            </Kb.Toast>
            <Kb.Button
              mode="Secondary"
              label="Copy to clipboard"
              disabled={actionsDisabled}
              onClick={() => copy()}
            />
          </Kb.Box2>
          {canSaveAsText && (
            <Kb.Button
              mode="Secondary"
              label="Save as TXT"
              onClick={onSaveAsText}
              disabled={actionsDisabled}
            />
          )}
        </Kb.ButtonBar>
      )}
    </Kb.Box2>
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

const OutputFileDestination = (props: {operation: Types.Operations}) => {
  const {operation} = props
  const operationTitle = capitalize(operation)
  const dispatch = Container.useDispatch()

  const input = Container.useSelector(state => state.crypto[operation].input.stringValue())

  const onOpenFile = async () => {
    const defaultPath = dirname(input)
    const options = {
      allowDirectories: true,
      allowFiles: false,
      buttonLabel: 'Select',
      ...(Platforms.isDarwin ? {defaultPath} : {}),
    }
    const filePaths = await showOpenDialog(options)
    if (!filePaths) return
    const path = filePaths[0]

    const destinationDir = new Container.HiddenString(path)
    dispatch(
      CryptoGen.createRunFileOperation({
        destinationDir,
        operation,
      })
    )
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.ButtonBar>
        <Kb.Button mode="Primary" label={`${operationTitle} to ...`} onClick={() => onOpenFile()} />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const Output = (props: OutputProps) => {
  const {operation} = props
  const textType = Constants.getOutputTextType(operation)
  const dispatch = Container.useDispatch()

  const inputType = Container.useSelector(state => state.crypto[operation].inputType)
  const inProgress = Container.useSelector(state => state.crypto[operation].inProgress)
  const output = Container.useSelector(state => state.crypto[operation].output.stringValue())
  const outputValid = Container.useSelector(state => state.crypto[operation].outputValid)
  const outputStatus = Container.useSelector(state => state.crypto[operation].outputStatus)
  const outputType = Container.useSelector(state => state.crypto[operation].outputType)

  const onShowInFinder = () => {
    if (!output) return
    dispatch(FSGen.createOpenLocalPathInSystemFileManager({localPath: output}))
  }

  const waitingKey = Constants.getStringWaitingKey(operation)
  const waiting = Container.useAnyWaiting(waitingKey)

  // Output text can be 24 px when output is less that 120 characters
  const outputTextIsLarge =
    operation === Constants.Operations.Decrypt || operation === Constants.Operations.Verify
  const {fontSize, lineHeight} = getStyle('HeaderBig')
  const outputLargeStyle = outputTextIsLarge &&
    output &&
    output.length <= largeOutputLimit && {fontSize, lineHeight}

  const fileOutputTextColor =
    textType === 'cipher' ? Styles.globalColors.greenDark : Styles.globalColors.black
  const fileIcon = Constants.getOutputFileIcon(operation)
  const actionsDisabled = waiting || !outputValid

  // Placeholder, progress, or encrypt file button
  if (!outputStatus || outputStatus !== 'success') {
    return (
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        style={Styles.collapseStyles([styles.coverOutput, styles.outputPlaceholder])}
      >
        {inProgress ? (
          <OutputProgress operation={operation} />
        ) : (
          inputType === 'file' &&
          outputStatus !== 'pending' && <OutputFileDestination operation={operation} />
        )}
      </Kb.Box2>
    )
  }

  // File output
  if (outputType === 'file') {
    return (
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
            onClick={() => onShowInFinder()}
          >
            {output}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  // Text output
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <Kb.Text
        type={textType === 'cipher' ? 'Terminal' : 'Body'}
        selectable={!actionsDisabled}
        style={Styles.collapseStyles([styles.output, outputLargeStyle])}
      >
        {output}
      </Kb.Text>
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
      coverOutput: {...Styles.globalStyles.flexBoxCenter},
      fileOutputContainer: {...Styles.padding(Styles.globalMargins.xsmall)},
      fileOutputText: {...Styles.globalStyles.fontSemibold},
      output: Styles.platformStyles({
        common: {color: Styles.globalColors.black},
        isElectron: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'},
      }),
      outputBarContainer: {...Styles.padding(Styles.globalMargins.tiny)},
      outputPlaceholder: {backgroundColor: Styles.globalColors.blueGreyLight},
      outputVerifiedContainer: {marginBottom: Styles.globalMargins.xlarge},
      placeholder: {color: Styles.globalColors.black_50},
      progressBar: {
        width: 200,
      },
      signedContainer: {
        minHeight: Styles.globalMargins.mediumLarge,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      signedIcon: {color: Styles.globalColors.green},
      signedSender: {...Styles.globalStyles.flexGrow},
      toastText: {
        color: Styles.globalColors.white,
        textAlign: 'center',
      },
    } as const)
)

export default Output
