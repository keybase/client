import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {CommonState} from './helpers'
import * as Kb from '@/common-adapters'
import * as FS from '@/constants/fs'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import {pickFiles} from '@/util/misc'

type CommonProps = {
  state: CommonState
}

type TextProps = CommonProps & {
  allowDirectories: boolean
  emptyInputWidth: number
  inputPlaceholder: string
  onChangeText: (text: string) => void
  onSetFile: (path: string) => void
  setBlurCB?: (cb: () => void) => void
  textInputType: 'cipher' | 'plain'
}

type FileProps = CommonProps & {
  fileIcon: IconType
  onClearFiles: () => void
}

type DragAndDropProps = {
  allowFolders: boolean
  children: React.ReactNode
  inProgress: boolean
  onAttach: (path: string) => void
  prompt: string
}

type RunActionBarProps = {
  blurCBRef?: React.RefObject<() => void>
  children?: React.ReactNode
  onRun: () => void
  runLabel: string
}

type InputProps = CommonProps & {
  allowDirectories: boolean
  emptyInputWidth: number
  fileIcon: IconType
  inputPlaceholder: string
  onClearInput: () => void
  onSetInput: (type: T.Crypto.InputTypes, value: string) => void
  setBlurCB?: (cb: () => void) => void
  textInputType: 'cipher' | 'plain'
}

type BannerContent = React.ComponentProps<typeof Kb.BannerParagraph>['content']

export type CryptoBannerProps = {
  infoMessage: BannerContent
  state: CommonState
}

const TextInput = (props: TextProps) => {
  const {allowDirectories, emptyInputWidth, inputPlaceholder, state, onChangeText, onSetFile, setBlurCB, textInputType} =
    props
  const value = state.inputType === 'text' ? state.input : ''

  const inputRef = React.useRef<Kb.Input3Ref>(null)
  const onFocusInput = () => {
    inputRef.current?.focus()
  }

  React.useEffect(() => {
    setBlurCB?.(() => {
      inputRef.current?.blur()
    })
    return () => {
      setBlurCB?.(() => {})
    }
  }, [setBlurCB])

  const onOpenFile = () => {
    const f = async () => {
      const filePaths = await pickFiles({
        allowDirectories: allowDirectories && C.isDarwin,
        buttonLabel: 'Select',
      })
      if (!filePaths.length) return
      onSetFile(filePaths[0] ?? '')
    }
    C.ignorePromise(f())
  }

  const rowsMax = Kb.Styles.isMobile ? undefined : value ? undefined : 1
  const growAndScroll = !Kb.Styles.isMobile && !!value
  const inputStyle = Kb.Styles.collapseStyles([
    styles.input,
    value ? styles.inputFull : styles.inputEmpty,
    !value && !Kb.Styles.isMobile && {width: emptyInputWidth},
  ])
  const inputContainerStyle = value ? styles.inputContainer : styles.inputContainerEmpty

  const browseButton = value ? null : (
    <Kb.Text type="BodyPrimaryLink" style={styles.browseFile} onClick={onOpenFile}>
      browse
    </Kb.Text>
  )
  const clearButton = value ? (
    <Kb.Box2 direction="vertical" style={styles.clearButtonInput}>
      <Kb.Text type="BodySmallPrimaryLink" onClick={() => onChangeText('')}>
        Clear
      </Kb.Text>
    </Kb.Box2>
  ) : null

  return (
    <Kb.ClickableBox onClick={onFocusInput} style={styles.containerInputFocus}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.commonContainer}>
        <Kb.Box2
          direction={Kb.Styles.isMobile ? 'vertical' : 'horizontal'}
          alignItems="flex-start"
          alignSelf="flex-start"
          fullWidth={Kb.Styles.isMobile || !!value}
          fullHeight={Kb.Styles.isMobile || !!value}
          style={styles.inputAndFilePickerContainer}
        >
          <Kb.Input3
            value={value}
            placeholder={inputPlaceholder}
            multiline={true}
            autoFocus={true}
            hideBorder={true}
            rowsMax={rowsMax}
            growAndScroll={growAndScroll}
            containerStyle={inputContainerStyle}
            inputStyle={inputStyle}
            textType={textInputType === 'cipher' ? 'Terminal' : 'Body'}
            autoCorrect={textInputType !== 'cipher'}
            spellCheck={textInputType !== 'cipher'}
            onChangeText={onChangeText}
            ref={inputRef}
          />
          {!Kb.Styles.isMobile && browseButton}
        </Kb.Box2>
      </Kb.Box2>
      {!Kb.Styles.isMobile && clearButton}
    </Kb.ClickableBox>
  )
}

const FileInput = ({fileIcon, onClearFiles, state}: FileProps) => {
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyCrypto)

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="stretch"
      style={styles.commonContainer}
    >
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.fileContainer}>
          <Kb.ImageIcon type={fileIcon} />
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySemibold">{state.input}</Kb.Text>
            {state.bytesTotal ? (
              <Kb.Text type="BodySmallSemibold">{FS.humanReadableFileSize(state.bytesTotal)}</Kb.Text>
            ) : null}
          </Kb.Box2>
        </Kb.Box2>
        {state.input && !waiting && (
          <Kb.Box2 direction="vertical" style={styles.clearButtonInput}>
            <Kb.Text type="BodySmallPrimaryLink" onClick={onClearFiles} style={styles.clearButtonInput}>
              Clear
            </Kb.Text>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

export const Input = ({
  allowDirectories,
  emptyInputWidth,
  fileIcon,
  inputPlaceholder,
  onClearInput,
  onSetInput,
  setBlurCB,
  state,
  textInputType,
}: InputProps) =>
  state.inputType === 'file' ? (
    <FileInput fileIcon={fileIcon} state={state} onClearFiles={onClearInput} />
  ) : (
    <TextInput
      allowDirectories={allowDirectories}
      emptyInputWidth={emptyInputWidth}
      inputPlaceholder={inputPlaceholder}
      setBlurCB={setBlurCB}
      state={state}
      textInputType={textInputType}
      onSetFile={path => onSetInput('file', path)}
      onChangeText={text => onSetInput('text', text)}
    />
  )

export const DragAndDrop = ({allowFolders, children, inProgress, onAttach, prompt}: DragAndDropProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Kb.DragAndDrop
      disabled={inProgress}
      allowFolders={allowFolders}
      fullHeight={true}
      fullWidth={true}
      onAttach={localPaths => onAttach(localPaths[0] ?? '')}
      prompt={prompt}
    >
      {children}
    </Kb.DragAndDrop>
  </Kb.Box2>
)

export const CryptoBanner = ({infoMessage, state}: CryptoBannerProps) => {
  if (!state.errorMessage && !state.warningMessage) {
    return (
      <Kb.Banner color="grey">
        <Kb.BannerParagraph bannerColor="grey" content={infoMessage} />
      </Kb.Banner>
    )
  }

  return (
    <>
      {state.errorMessage ? (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content={state.errorMessage} />
        </Kb.Banner>
      ) : null}
      {state.warningMessage ? (
        <Kb.Banner color="yellow">
          <Kb.BannerParagraph bannerColor="yellow" content={state.warningMessage} />
        </Kb.Banner>
      ) : null}
    </>
  )
}

export const InputActionsBar = ({blurCBRef, children, onRun, runLabel}: RunActionBarProps) => {
  const onClick = () => {
    blurCBRef?.current()
    setTimeout(() => {
      onRun()
    }, 100)
  }

  return Kb.Styles.isMobile ? (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      gap={Kb.Styles.isTablet ? 'small' : 'tiny'}
      style={styles.inputActionsBarContainer}
    >
      {children}
      <Kb.WaitingButton
        mode="Primary"
        waitingKey={C.waitingKeyCrypto}
        label={runLabel}
        fullWidth={true}
        onClick={onClick}
      />
    </Kb.Box2>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      browseFile: {
        flexShrink: 0,
      },
      clearButtonInput: {
        alignSelf: 'flex-start',
        flexShrink: 1,
        padding: Kb.Styles.globalMargins.tiny,
      },
      commonContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        ...Kb.Styles.globalStyles.positionRelative,
      },
      containerInputFocus: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexGrow,
          ...Kb.Styles.globalStyles.fullHeight,
          display: 'flex',
        },
        isMobile: {
          flexShrink: 1,
          marginTop: 1,
        },
      }),
      fileContainer: {
        alignSelf: 'flex-start',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
      input: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.black,
        },
        isMobile: {
          ...Kb.Styles.globalStyles.fullHeight,
        },
      }),
      inputActionsBarContainer: Kb.Styles.platformStyles({
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
          alignItems: 'flex-start',
          backgroundColor: Kb.Styles.globalColors.blueGrey,
        },
      }),
      inputAndFilePickerContainer: Kb.Styles.platformStyles({
        isElectron: {
          paddingBottom: 0,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: 0,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      inputContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fullHeight,
          alignItems: 'stretch',
          padding: 0,
        },
        isMobile: {
          ...Kb.Styles.globalStyles.fullHeight,
          ...Kb.Styles.padding(0),
        },
      }),
      inputContainerEmpty: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(0),
        },
        isMobile: {
          ...Kb.Styles.globalStyles.fullHeight,
          ...Kb.Styles.padding(0),
        },
      }),
      inputEmpty: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(0),
          overflowY: 'hidden',
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
          paddingTop: Kb.Styles.globalMargins.xsmall,
        },
      }),
      inputFull: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(0),
        },
        isElectron: {
          paddingRight: 46,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.xsmall,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
          paddingTop: Kb.Styles.globalMargins.xsmall,
        },
      }),
    }) as const
)
