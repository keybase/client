import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Path from '@/util/path'
import * as React from 'react'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import type {CommonState} from './helpers'
import {pickFiles} from '@/util/misc'
import {useFSState} from '@/stores/fs'
import * as FS from '@/constants/fs'
import {useConfigState} from '@/stores/config'

type CryptoOutputProps = {
  actionLabel: string
  onChooseOutputFolder: (destinationDir: string) => void
  outputFileIcon?: IconType
  outputTextType: 'cipher' | 'plain'
  state: CommonState
}

type OutputActionsBarProps = {
  canReplyInChat: boolean
  canSaveAsText: boolean
  onSaveAsText?: () => void
  state: CommonState
}

type SignedSenderProps = {
  isSelfSigned: boolean
  state: CommonState
}

type OutputInfoProps = {
  children:
    | string
    | React.ReactElement<typeof Kb.BannerParagraph>
    | Array<React.ReactElement<typeof Kb.BannerParagraph>>
  outputStatus?: CommonState['outputStatus']
}

export const CryptoSignedSender = ({isSelfSigned, state}: SignedSenderProps) => {
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyCrypto)
  const signed = state.outputSigned
  const signedByUsername = state.outputSenderUsername
  const signedByFullname = state.outputSenderFullname

  const avatarSize = isSelfSigned ? 16 : Kb.Styles.isMobile ? 32 : 48
  const usernameType = isSelfSigned ? 'BodySmallBold' : 'BodyBold'

  const space = Kb.Styles.isMobile ? '' : ' '
  const signedByText = `Signed by ${isSelfSigned ? `${space}you` : ''}`

  if (!state.outputStatus) {
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
            <Kb.Avatar key="avatar" size={avatarSize} username={signedByUsername} />
            {isSelfSigned ? (
              <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.signedByText}>
                <Kb.Text key="signedByUsername" type="BodySmall">
                  {signedByText}
                </Kb.Text>
                <Kb.ConnectedUsernames
                  key="username"
                  type={usernameType}
                  usernames={[signedByUsername]}
                  colorFollowing={true}
                  colorYou={true}
                />
              </Kb.Box2>
            ) : (
              <Kb.Box2 key="signedByUsername" direction="vertical">
                <Kb.ConnectedUsernames
                  type={usernameType}
                  usernames={[signedByUsername]}
                  colorFollowing={true}
                  colorYou={true}
                />
                {signedByFullname ? <Kb.Text type="BodySmall">{signedByFullname}</Kb.Text> : null}
              </Kb.Box2>
            )}
          </Kb.Box2>
        ) : (
          <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" style={styles.signedSender}>
            <Kb.ImageIcon key="avatar" type="icon-placeholder-secret-user-16" />
            {isSelfSigned ? null : (
              <Kb.Text key="username" type="BodySmallSemibold">
                Anonymous sender
              </Kb.Text>
            )}
            <Kb.Text key="signedByUsername" type="BodySmall">
              {isSelfSigned ? 'Not signed (Sending anonymously)' : '(Not signed)'}
            </Kb.Text>
          </Kb.Box2>
        )}
        {waiting && <Kb.ProgressIndicator type="Small" white={false} />}
      </Kb.Box2>
    </>
  )
}

const OutputProgress = ({state}: {state: CommonState}) => {
  if (!state.inProgress) {
    return null
  }
  if (!state.bytesTotal) {
    return <Kb.ProgressIndicator type="Large" white={false} />
  }

  const ratio = state.bytesComplete === 0 ? 0 : state.bytesComplete / state.bytesTotal
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
      <Kb.ProgressBar ratio={ratio} style={styles.progressBar} />
      <Kb.Text type="Body">{`${FS.humanizeBytes(state.bytesComplete, 1)} / ${FS.humanizeBytes(
        state.bytesTotal,
        1
      )}`}</Kb.Text>
    </Kb.Box2>
  )
}

export const OutputInfoBanner = ({outputStatus, children}: OutputInfoProps) =>
  outputStatus === 'success' ? (
    <Kb.Banner
      color="grey"
      style={styles.banner}
      textContainerStyle={styles.bannerContainer}
      narrow={Kb.Styles.isMobile}
    >
      {children}
    </Kb.Banner>
  ) : null

export const CryptoOutputActionsBar = ({
  canReplyInChat,
  canSaveAsText,
  onSaveAsText,
  state,
}: OutputActionsBarProps) => {
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyCrypto)
  const actionsDisabled = waiting || !state.outputValid

  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = () => {
    openLocalPathInSystemFileManagerDesktop?.(state.output)
  }

  const navigateUp = C.Router2.navigateUp
  const previewConversation = C.Router2.previewConversation
  const onReplyInChat = (username: string) => {
    navigateUp()
    previewConversation({participants: [username], reason: 'search'})
  }

  const copyToClipboard = useConfigState(s => s.dispatch.copyToClipboard)
  const popupAnchor = React.useRef<Kb.MeasureRef | null>(null)
  const [showingToast, setShowingToast] = React.useState(false)
  const setHideToastTimeout = Kb.useTimeout(() => setShowingToast(false), 1500)
  const [lastShowingToast, setLastShowingToast] = React.useState(showingToast)
  if (lastShowingToast !== showingToast) {
    setLastShowingToast(showingToast)
    if (showingToast) {
      setHideToastTimeout()
    }
  }

  const copy = () => {
    if (!state.output) return
    setShowingToast(true)
    copyToClipboard(state.output)
  }

  return state.outputStatus === 'success' ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.outputActionsBarContainer}>
      {state.outputType === 'file' && !Kb.Styles.isMobile ? (
        <Kb.ButtonBar direction="row" align="flex-start" style={styles.buttonBar}>
          <Kb.Button
            mode="Secondary"
            label={`Open in ${Kb.Styles.fileUIName}`}
            onClick={onShowInFinder}
          />
        </Kb.ButtonBar>
      ) : (
        <Kb.ButtonBar
          direction="row"
          align={Kb.Styles.isTablet ? 'center' : 'flex-start'}
          style={styles.buttonBar}
        >
          {canReplyInChat && state.outputSigned && state.outputSenderUsername ? (
            <Kb.Button
              mode="Primary"
              label="Reply in chat"
              disabled={actionsDisabled}
              fullWidth={Kb.Styles.isMobile}
              onClick={() => onReplyInChat(state.outputSenderUsername ?? '')}
            />
          ) : null}
          <Kb.Box2 direction="horizontal" ref={popupAnchor}>
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
                onClick={copy}
              />
            )}
          </Kb.Box2>
          {canSaveAsText && !Kb.Styles.isMobile && onSaveAsText ? (
            <Kb.Button
              mode="Secondary"
              label="Save as TXT"
              onClick={onSaveAsText}
              disabled={actionsDisabled}
            />
          ) : null}
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

const OutputFileDestination = ({
  actionLabel,
  input,
  onChooseOutputFolder,
}: {
  actionLabel: string
  input: string
  onChooseOutputFolder: (destinationDir: string) => void
}) => {
  const onOpenFile = () => {
    const f = async () => {
      const defaultPath = Path.dirname(input)
      const filePaths = await pickFiles({
        allowDirectories: true,
        allowFiles: false,
        buttonLabel: 'Select',
        ...(C.isDarwin ? {defaultPath} : {}),
      })
      if (!filePaths.length) return
      onChooseOutputFolder(filePaths[0] ?? '')
    }
    C.ignorePromise(f())
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.ButtonBar>
        <Kb.Button mode="Primary" label={`${actionLabel} to ...`} onClick={onOpenFile} />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const MobileScroll = Kb.Styles.isMobile ? Kb.ScrollView : React.Fragment

export const CryptoOutput = ({
  actionLabel,
  onChooseOutputFolder,
  outputFileIcon,
  outputTextType,
  state,
}: CryptoOutputProps) => {
  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.openLocalPathInSystemFileManagerDesktop
  )
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyCrypto)
  const actionsDisabled = waiting || !state.outputValid

  const fileOutputTextColor =
    outputTextType === 'cipher' ? Kb.Styles.globalColors.greenDark : Kb.Styles.globalColors.black

  if (state.outputStatus !== 'success') {
    return (
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.coverOutput, styles.outputPlaceholder])}
      >
        {state.inProgress ? (
          <OutputProgress state={state} />
        ) : (
          state.inputType === 'file' &&
          state.outputStatus !== 'pending' && (
            <OutputFileDestination
              actionLabel={actionLabel}
              input={state.input}
              onChooseOutputFolder={onChooseOutputFolder}
            />
          )
        )}
      </Kb.Box2>
    )
  }

  if (state.outputType === 'file') {
    return (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          style={styles.fileOutputContainer}
        >
          {outputFileIcon ? <Kb.ImageIcon type={outputFileIcon} /> : null}
          <Kb.Text
            type="BodyPrimaryLink"
            style={Kb.Styles.collapseStyles([styles.fileOutputText, {color: fileOutputTextColor}])}
            onClick={() => state.output && openLocalPathInSystemFileManagerDesktop?.(state.output)}
          >
            {state.output}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <MobileScroll>
        <Kb.Text
          type={outputTextType === 'cipher' ? 'Terminal' : 'Body'}
          selectable={!actionsDisabled}
          style={styles.output}
        >
          {state.output}
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
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      signedContainerSelf: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.tiny),
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
        },
      }),
      signedSender: {alignItems: 'center'},
      toastText: {color: Kb.Styles.globalColors.white},
    }) as const
)
