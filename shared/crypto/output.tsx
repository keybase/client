import * as C from '@/constants'
import * as Constants from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as Path from '@/util/path'
import * as Platforms from '@/constants/platform'
import * as React from 'react'
import capitalize from 'lodash/capitalize'
import type * as T from '@/constants/types'
import {getStyle} from '@/common-adapters/text'
import {humanizeBytes} from '@/constants/fs'
import {pickFiles} from '@/util/pick-files'
import type HiddenString from '@/util/hidden-string'

type OutputProps = {operation: T.Crypto.Operations}
type OutputActionsBarProps = {operation: T.Crypto.Operations}
type SignedSenderProps = {operation: T.Crypto.Operations}
type OutputProgressProps = {operation: T.Crypto.Operations}
type OutputInfoProps = {
  operation: T.Crypto.Operations
  children:
    | string
    | React.ReactElement<typeof Kb.BannerParagraph>
    | Array<React.ReactElement<typeof Kb.BannerParagraph>>
}

const largeOutputLimit = 120

export const SignedSender = (props: SignedSenderProps) => {
  const {operation} = props
  const waiting = C.Waiting.useAnyWaiting(Constants.waitingKey)

  const {
    outputSigned: signed,
    outputSenderUsername: signedByUsername,
    outputSenderFullname: signedByFullname,
    outputStatus,
  } = C.useCryptoState(
    C.useShallow(s => {
      const o = s[operation]
      const {outputSigned, outputSenderUsername, outputSenderFullname, outputStatus} = o
      return {outputSenderFullname, outputSenderUsername, outputSigned, outputStatus}
    })
  )

  const isSelfSigned = operation === Constants.Operations.Encrypt || operation === Constants.Operations.Sign
  const avatarSize = isSelfSigned ? 16 : Kb.Styles.isMobile ? 32 : 48
  const usernameType = isSelfSigned ? 'BodySmallBold' : 'BodyBold'

  const space = Kb.Styles.isMobile ? '' : ' '
  const signedByText = `Signed by ${isSelfSigned ? `${space}you` : ''}`

  if (!outputStatus || outputStatus === 'error') {
    return null
  }

  return (
    <>
      <Kb.Divider />
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        style={Kb.Styles.collapseStyles([
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
              <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.signedByText}>
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
                  <Kb.Text type="BodySmall">{signedByFullname.stringValue()}</Kb.Text>
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

const OutputProgress = (props: OutputProgressProps) => {
  const {operation} = props

  const {bytesComplete, bytesTotal, inProgress} = C.useCryptoState(
    C.useShallow(s => {
      const o = s[operation]
      const {bytesComplete, bytesTotal, inProgress} = o
      return {bytesComplete, bytesTotal, inProgress}
    })
  )

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

  const outputStatus = C.useCryptoState(s => s[operation].outputStatus)
  return outputStatus === 'success' ? (
    <Kb.Banner
      color="grey"
      style={styles.banner}
      textContainerStyle={styles.bannerContainer}
      narrow={Kb.Styles.isMobile}
    >
      {props.children}
    </Kb.Banner>
  ) : null
}

export const OutputActionsBar = (props: OutputActionsBarProps) => {
  const {operation} = props
  const canSaveAsText = operation === Constants.Operations.Encrypt || operation === Constants.Operations.Sign
  const canReplyInChat =
    operation === Constants.Operations.Decrypt || operation === Constants.Operations.Verify

  const waiting = C.Waiting.useAnyWaiting(Constants.waitingKey)

  const {
    output,
    outputValid,
    outputStatus,
    outputType,
    outputSigned: signed,
    outputSenderUsername: signedByUsername,
  } = C.useCryptoState(
    C.useShallow(s => {
      const o = s[operation]
      const {output, outputValid, outputStatus, outputType, outputSigned, outputSenderUsername} = o
      return {output, outputSenderUsername, outputSigned, outputStatus, outputType, outputValid}
    })
  )

  const actionsDisabled = waiting || !outputValid

  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = () => {
    openLocalPathInSystemFileManagerDesktop?.(output.stringValue())
  }

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onReplyInChat = (username: HiddenString) => {
    navigateUp()
    previewConversation({participants: [username.stringValue()], reason: 'search'})
  }

  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopyOutput = () => {
    copyToClipboard(output.stringValue())
  }

  const downloadSignedText = C.useCryptoState(s => s.dispatch.downloadSignedText)
  const downloadEncryptedText = C.useCryptoState(s => s.dispatch.downloadEncryptedText)

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

  const popupAnchor = React.useRef<Kb.MeasureRef>(null)
  const [showingToast, setShowingToast] = React.useState(false)

  const setHideToastTimeout = Kb.useTimeout(() => setShowingToast(false), 1500)

  const copy = () => {
    if (!output.stringValue()) return
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
      {outputType === 'file' && !Kb.Styles.isMobile ? (
        <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
          <Kb.Button
            mode="Secondary"
            label={`Open in ${Kb.Styles.fileUIName}`}
            onClick={() => onShowInFinder()}
          />
        </Kb.ButtonBar>
      ) : (
        <Kb.ButtonBar
          direction="row"
          align={Kb.Styles.isTablet ? 'center' : 'flex-start'}
          style={styles.buttonBar}
        >
          {canReplyInChat && signed && signedByUsername && (
            <Kb.Button
              mode="Primary"
              label="Reply in chat"
              disabled={actionsDisabled}
              fullWidth={Kb.Styles.isMobile}
              onClick={() => onReplyInChat(signedByUsername)}
            />
          )}
          <Kb.Box2Measure direction="horizontal" ref={popupAnchor}>
            <Kb.Toast position="top center" attachTo={popupAnchor} visible={showingToast}>
              <Kb.Text type="BodySmall" style={styles.toastText}>
                Copied to clipboard
              </Kb.Text>
            </Kb.Toast>
            {Kb.Styles.isMobile && canReplyInChat ? null : (
              <Kb.Button
                mode={Kb.Styles.isMobile ? 'Primary' : 'Secondary'}
                label="Copy to clipboard"
                disabled={actionsDisabled}
                fullWidth={Kb.Styles.isMobile}
                onClick={() => copy()}
              />
            )}
          </Kb.Box2Measure>
          {canSaveAsText && !Kb.Styles.isMobile && (
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
      style={Kb.Styles.collapseStyles([styles.outputActionsBarContainer, styles.outputPlaceholder])}
    >
      <Kb.ButtonBar direction="row" style={styles.buttonBar}>
        {null}
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const OutputFileDestination = (props: {operation: T.Crypto.Operations}) => {
  const {operation} = props
  const operationTitle = capitalize(operation)

  const input = C.useCryptoState(s => s[operation].input.stringValue())
  const runFileOperation = C.useCryptoState(s => s.dispatch.runFileOperation)

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
    C.ignorePromise(f())
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.ButtonBar>
        <Kb.Button mode="Primary" label={`${operationTitle} to ...`} onClick={onOpenFile} />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const MobileScroll = Kb.Styles.isMobile ? Kb.ScrollView : React.Fragment

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
  } = C.useCryptoState(
    C.useShallow(s => {
      const o = s[operation]
      const {inProgress, inputType, output, outputValid, outputStatus, outputType} = o
      return {inProgress, inputType, output, outputStatus, outputType, outputValid}
    })
  )
  const output = _output.stringValue()

  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = () => {
    if (!output) return
    openLocalPathInSystemFileManagerDesktop?.(output)
  }

  const waiting = C.Waiting.useAnyWaiting(Constants.waitingKey)

  // Output text can be 24 px when output is less that 120 characters
  const outputTextIsLarge =
    operation === Constants.Operations.Decrypt || operation === Constants.Operations.Verify
  const {fontSize, lineHeight} = getStyle('HeaderBig')
  const outputLargeStyle = outputTextIsLarge &&
    output &&
    output.length <= largeOutputLimit && {fontSize, lineHeight}

  const fileOutputTextColor =
    textType === 'cipher' ? Kb.Styles.globalColors.greenDark : Kb.Styles.globalColors.black
  const fileIcon = outputFileIcon.get(operation)
  const actionsDisabled = waiting || !outputValid

  // Placeholder, progress, or encrypt file button
  if (!outputStatus || outputStatus !== 'success') {
    return (
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.coverOutput, styles.outputPlaceholder])}
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
            style={Kb.Styles.collapseStyles([styles.fileOutputText, {color: fileOutputTextColor}])}
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
          style={Kb.Styles.collapseStyles([styles.output, outputLargeStyle])}
        >
          {output}
        </Kb.Text>
      </MobileScroll>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
        minHeight: 40,
      },
      bannerContainer: {
        ...Kb.Styles.padding(0),
      },
      buttonBar: {
        height: Kb.Styles.globalMargins.large,
        minHeight: Kb.Styles.globalMargins.large,
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexGrow,
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
          overflowY: 'auto',
        },
        isMobile: {
          flexShrink: 1,
        },
      }),
      coverOutput: {...Kb.Styles.globalStyles.flexBoxCenter},
      fileOutputContainer: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall)},
      fileOutputText: {...Kb.Styles.globalStyles.fontSemibold},
      output: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.black,
        },
        isElectron: {
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
        },
      }),
      outputActionsBarContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
          backgroundColor: Kb.Styles.globalColors.blueGrey,
        },
        isTablet: {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
      outputPlaceholder: {backgroundColor: Kb.Styles.globalColors.blueGreyLight},
      outputVerifiedContainer: {marginBottom: Kb.Styles.globalMargins.xlarge},
      placeholder: {color: Kb.Styles.globalColors.black_50},
      progressBar: {
        width: 200,
      },
      signedByText: {
        alignItems: 'baseline',
      },
      signedContainer: Kb.Styles.platformStyles({
        common: {
          flexShrink: 0,
          justifyContent: 'center',
          minHeight: Kb.Styles.globalMargins.mediumLarge,
        },
        isMobile: {
          minHeight: Kb.Styles.globalMargins.large,
        },
      }),
      signedContainerOther: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
        },
      }),
      signedContainerSelf: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
        },
      }),
      signedIcon: {color: Kb.Styles.globalColors.green},
      signedSender: {
        ...Kb.Styles.globalStyles.flexGrow,
      },
      toastText: {
        color: Kb.Styles.globalColors.white,
        textAlign: 'center',
      },
    }) as const
)
