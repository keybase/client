import * as Chat2Gen from '../actions/chat2-gen'
import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/crypto'
import * as FSConstants from '../constants/fs'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Path from '../util/path'
import * as Platforms from '../constants/platform'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import capitalize from 'lodash/capitalize'
import shallowEqual from 'shallowequal'
import type * as Types from '../constants/types/crypto'
import {getStyle} from '../common-adapters/text'
import {humanizeBytes} from '../constants/fs'
import {pickFiles} from '../util/pick-files'

type OutputProps = {
  operation: Types.Operations
}

type OutputActionsBarProps = {
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
  const waiting = Container.useAnyWaiting(Constants.waitingKey)

  const {
    outputSigned: signed,
    outputSenderUsername: signedByUsername,
    outputSenderFullname: signedByFullname,
    outputStatus,
  } = Constants.useState(s => {
    const o = s[operation]
    const {outputSigned, outputSenderUsername, outputSenderFullname, outputStatus} = o
    return {outputSenderFullname, outputSenderUsername, outputSigned, outputStatus}
  }, shallowEqual)

  const isSelfSigned = operation === Constants.Operations.Encrypt || operation === Constants.Operations.Sign
  const avatarSize = isSelfSigned ? 16 : Styles.isMobile ? 32 : 48
  const usernameType = isSelfSigned ? 'BodySmallBold' : 'BodyBold'

  const space = Styles.isMobile ? '' : ' '
  const signedByText = `Signed by ${isSelfSigned ? `${space}you` : ''}`

  if (!outputStatus || (outputStatus && outputStatus === 'error')) {
    return null
  }

  return (
    <>
      <Kb.Divider />
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        style={Styles.collapseStyles([
          styles.signedContainer,
          isSelfSigned ? styles.signedContainerSelf : styles.signedContainerOther,
        ])}
      >
        {signed && signedByUsername ? (
          <Kb.Box2
            direction="horizontal"
            gap={isSelfSigned ? 'xtiny' : 'xsmall'}
            alignItems="center"
            style={styles.signedSender}
          >
            <Kb.Avatar key="avatar" size={avatarSize} username={signedByUsername.stringValue()} />

            {isSelfSigned ? (
              <Kb.Box2
                direction="horizontal"
                gap={isSelfSigned ? 'xtiny' : 'xsmall'}
                style={styles.signedByText}
              >
                <Kb.Text key="signedByUsername" type="BodySmall">
                  {signedByText}
                </Kb.Text>
                <Kb.ConnectedUsernames
                  key="username"
                  type={usernameType}
                  usernames={[signedByUsername.stringValue()]}
                  colorFollowing={true}
                  colorYou={true}
                />
              </Kb.Box2>
            ) : (
              <Kb.Box2 key="signedByUsername" direction="vertical">
                <Kb.ConnectedUsernames
                  type={usernameType}
                  usernames={[signedByUsername.stringValue()]}
                  colorFollowing={true}
                  colorYou={true}
                />
                {signedByFullname?.stringValue() ? (
                  <Kb.Text type="BodySmall">{signedByFullname?.stringValue()}</Kb.Text>
                ) : null}
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
    </>
  )
}

export const OutputProgress = (props: OutputProgressProps) => {
  const {operation} = props

  const {bytesComplete, bytesTotal, inProgress} = Constants.useState(s => {
    const o = s[operation]
    const {bytesComplete, bytesTotal, inProgress} = o
    return {bytesComplete, bytesTotal, inProgress}
  }, shallowEqual)

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

  const outputStatus = Constants.useState(s => s[operation].outputStatus)
  return outputStatus === 'success' ? (
    <Kb.Banner
      color="grey"
      style={styles.banner}
      textContainerStyle={styles.bannerContainer}
      narrow={Styles.isMobile}
    >
      {props.children}
    </Kb.Banner>
  ) : null
}

export const OutputActionsBar = (props: OutputActionsBarProps) => {
  const {operation} = props
  const dispatch = Container.useDispatch()
  const canSaveAsText = operation === Constants.Operations.Encrypt || operation === Constants.Operations.Sign
  const canReplyInChat =
    operation === Constants.Operations.Decrypt || operation === Constants.Operations.Verify

  const waiting = Container.useAnyWaiting(Constants.waitingKey)

  const {
    output,
    outputValid,
    outputStatus,
    outputType,
    outputSigned: signed,
    outputSenderUsername: signedByUsername,
  } = Constants.useState(s => {
    const o = s[operation]
    const {output, outputValid, outputStatus, outputType, outputSigned, outputSenderUsername} = o
    return {output, outputSenderUsername, outputSigned, outputStatus, outputType, outputValid}
  }, shallowEqual)

  const actionsDisabled = waiting || !outputValid

  const openLocalPathInSystemFileManagerDesktop = FSConstants.useState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = () => {
    openLocalPathInSystemFileManagerDesktop?.(output.stringValue())
  }

  const onReplyInChat = (username: Container.HiddenString) => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username.stringValue()], reason: 'search'}))
  }

  const copyToClipboard = ConfigConstants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopyOutput = () => {
    copyToClipboard(output.stringValue())
  }

  const downloadSignedText = Constants.useState(s => s.dispatch.downloadSignedText)
  const downloadEncryptedText = Constants.useState(s => s.dispatch.downloadEncryptedText)

  const onSaveAsText = () => {
    if (operation === Constants.Operations.Sign) {
      downloadSignedText()
      return
    }

    if (operation === Constants.Operations.Encrypt) {
      downloadEncryptedText()
      return
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

  const [lastShowingToast, setLastShowingToast] = React.useState(showingToast)

  // Start timeout to clear toast if currently displayed
  if (lastShowingToast !== showingToast) {
    setLastShowingToast(showingToast)
    if (showingToast) {
      setHideToastTimeout()
    }
  }

  return outputStatus && outputStatus === 'success' ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outputActionsBarContainer}>
      {outputType === 'file' && !Styles.isMobile ? (
        <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
          <Kb.Button
            mode="Secondary"
            label={`Open in ${Styles.fileUIName}`}
            onClick={() => onShowInFinder()}
          />
        </Kb.ButtonBar>
      ) : (
        <Kb.ButtonBar
          direction="row"
          align={Styles.isTablet ? 'center' : 'flex-start'}
          style={styles.buttonBar}
        >
          {canReplyInChat && signed && signedByUsername && (
            <Kb.Button
              mode="Primary"
              label="Reply in chat"
              disabled={actionsDisabled}
              fullWidth={Styles.isMobile}
              onClick={() => onReplyInChat(signedByUsername)}
            />
          )}
          <Kb.Box2 direction="horizontal" ref={attachmentRef}>
            <Kb.Toast position="top center" attachTo={() => attachmentRef.current} visible={showingToast}>
              <Kb.Text type="BodySmall" style={styles.toastText}>
                Copied to clipboard
              </Kb.Text>
            </Kb.Toast>
            {Styles.isMobile && canReplyInChat ? null : (
              <Kb.Button
                mode={Styles.isMobile ? 'Primary' : 'Secondary'}
                label="Copy to clipboard"
                disabled={actionsDisabled}
                fullWidth={Styles.isMobile}
                onClick={() => copy()}
              />
            )}
          </Kb.Box2>
          {canSaveAsText && !Styles.isMobile && (
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
      style={Styles.collapseStyles([styles.outputActionsBarContainer, styles.outputPlaceholder])}
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

  const input = Constants.useState(s => s[operation].input.stringValue())
  const runFileOperation = Constants.useState(s => s.dispatch.runFileOperation)

  const onOpenFile = () => {
    const f = async () => {
      const defaultPath = Path.dirname(input)
      const filePaths = await pickFiles({
        allowDirectories: true,
        allowFiles: false,
        buttonLabel: 'Select',
        ...(Platforms.isDarwin ? {defaultPath} : {}),
      })
      if (!filePaths.length) return
      const path = filePaths[0]!
      runFileOperation(operation, path)
    }
    Container.ignorePromise(f())
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.ButtonBar>
        <Kb.Button mode="Primary" label={`${operationTitle} to ...`} onClick={onOpenFile} />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const MobileScroll = Styles.isMobile ? Kb.ScrollView : React.Fragment

const outputTextType = new Map([
  ['decrypt', 'plain'],
  ['encrypt', 'cipher'],
  ['sign', 'cipher'],
  ['verify', 'plain'],
] as const)

const outputFileIcon = new Map([
  ['decrypt', 'icon-file-64'],
  ['encrypt', 'icon-file-saltpack-64'],
  ['sign', 'icon-file-saltpack-64'],
  ['verify', 'icon-file-64'],
] as const)

export const OperationOutput = (props: OutputProps) => {
  const {operation} = props
  const textType = outputTextType.get(operation)

  const {
    inputType,
    inProgress,
    output: _output,
    outputValid,
    outputStatus,
    outputType,
  } = Constants.useState(s => {
    const o = s[operation]
    const {inProgress, inputType, output, outputValid, outputStatus, outputType} = o
    return {inProgress, inputType, output, outputStatus, outputType, outputValid}
  }, shallowEqual)
  const output = _output.stringValue()

  const openLocalPathInSystemFileManagerDesktop = FSConstants.useState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = () => {
    if (!output) return
    openLocalPathInSystemFileManagerDesktop?.(output)
  }

  const waiting = Container.useAnyWaiting(Constants.waitingKey)

  // Output text can be 24 px when output is less that 120 characters
  const outputTextIsLarge =
    operation === Constants.Operations.Decrypt || operation === Constants.Operations.Verify
  const {fontSize, lineHeight} = getStyle('HeaderBig')
  const outputLargeStyle = outputTextIsLarge &&
    output &&
    output.length <= largeOutputLimit && {fontSize, lineHeight}

  const fileOutputTextColor =
    textType === 'cipher' ? Styles.globalColors.greenDark : Styles.globalColors.black
  const fileIcon = outputFileIcon.get(operation)
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
          {fileIcon ? <Kb.Icon type={fileIcon} sizeType="Huge" /> : null}
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
      <MobileScroll>
        <Kb.Text
          type={textType === 'cipher' ? 'Terminal' : 'Body'}
          selectable={!actionsDisabled}
          style={Styles.collapseStyles([styles.output, outputLargeStyle])}
        >
          {output}
        </Kb.Text>
      </MobileScroll>
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
      bannerContainer: {
        ...Styles.padding(0),
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
        isMobile: {
          flexShrink: 1,
        },
      }),
      coverOutput: {...Styles.globalStyles.flexBoxCenter},
      fileOutputContainer: {...Styles.padding(Styles.globalMargins.xsmall)},
      fileOutputText: {...Styles.globalStyles.fontSemibold},
      output: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
        },
        isElectron: {
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.small),
        },
      }),
      outputActionsBarContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.padding(Styles.globalMargins.tiny),
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.small),
          backgroundColor: Styles.globalColors.blueGrey,
        },
        isTablet: {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
      outputPlaceholder: {backgroundColor: Styles.globalColors.blueGreyLight},
      outputVerifiedContainer: {marginBottom: Styles.globalMargins.xlarge},
      placeholder: {color: Styles.globalColors.black_50},
      progressBar: {
        width: 200,
      },
      signedByText: {
        alignItems: 'baseline',
      },
      signedContainer: Styles.platformStyles({
        common: {
          flexShrink: 0,
          justifyContent: 'center',
          minHeight: Styles.globalMargins.mediumLarge,
        },
        isMobile: {
          minHeight: Styles.globalMargins.large,
        },
      }),
      signedContainerOther: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.small),
        },
      }),
      signedContainerSelf: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.tiny),
        },
      }),
      signedIcon: {color: Styles.globalColors.green},
      signedSender: {
        ...Styles.globalStyles.flexGrow,
      },
      toastText: {
        color: Styles.globalColors.white,
        textAlign: 'center',
      },
    }) as const
)
