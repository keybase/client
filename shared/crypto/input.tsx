import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {CommonState} from './helpers'
import * as Kb from '@/common-adapters'
import * as FS from '@/constants/fs'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import {pickFiles} from '@/util/misc'
import {KeyboardStickyView, useKeyboardState} from 'react-native-keyboard-controller'
import {SafeAreaView as ScreensSafeAreaView} from 'react-native-screens/experimental'
import {useNavigation} from '@react-navigation/native'
import type {ParamListBase} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

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
  testID?: string
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
  testID?: string
}

// RNScreens' SafeAreaView hardcodes `flex: 1` (i.e. flexBasis 0%), which collapses the
// bar to zero height inside the keyboard sticky view. A `flexBasis`/`flexGrow` override
// loses to the `flex` shorthand in the style merge, so unset `flex` itself (plain object,
// not styleSheetCreate, so the undefined survives) and let the bar size to its content.
const unsetLibFlex = {flex: undefined}

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
  testID?: string
  textInputType: 'cipher' | 'plain'
}

type BannerContent = React.ComponentProps<typeof Kb.BannerParagraph>['content']

export type CryptoBannerProps = {
  infoMessage: BannerContent
  state: CommonState
}

const TextInput = (props: TextProps) => {
  const {allowDirectories, emptyInputWidth, inputPlaceholder, state, onChangeText, onSetFile, setBlurCB, testID, textInputType} =
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

  // On mobile, autoFocus fires during the push transition, so the keyboard animates up
  // while the screen is still sliding in — the content visibly thrashes. Instead wait for
  // the native-stack transition to finish, then focus so the keyboard raises cleanly over
  // a settled screen. Desktop has no keyboard, so it keeps instant autoFocus.
  const navigation = useNavigation() as unknown as NativeStackNavigationProp<ParamListBase>
  React.useEffect(() => {
    if (!isMobile) return
    return navigation.addListener('transitionEnd', e => {
      if (!e.data.closing) {
        inputRef.current?.focus()
      }
    })
  }, [navigation])

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

  const rowsMax = isMobile ? undefined : value ? undefined : 1
  const growAndScroll = !isMobile && !!value
  const inputStyle = Kb.Styles.collapseStyles([
    styles.input,
    value ? styles.inputFull : styles.inputEmpty,
    !value && !isMobile && {width: emptyInputWidth},
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
    <Kb.ClickableBox
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      onClick={onFocusInput}
      testID={testID}
      style={Kb.Styles.collapseStyles([styles.containerInputFocus, styles.commonContainer])}
    >
      <Kb.Box2
        direction={isMobile ? 'vertical' : 'horizontal'}
        alignItems="flex-start"
        alignSelf="flex-start"
        fullWidth={isMobile || !!value}
        fullHeight={isMobile || !!value}
        style={styles.inputAndFilePickerContainer}
      >
        <Kb.Input3
          value={value}
          placeholder={inputPlaceholder}
          multiline={true}
          autoFocus={!isMobile}
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
        {!isMobile && browseButton}
      </Kb.Box2>
      {!isMobile && clearButton}
    </Kb.ClickableBox>
  )
}

const FileInput = ({fileIcon, onClearFiles, state}: FileProps) => {
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyCrypto)

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.commonContainer}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        alignSelf="flex-start"
        padding="small"
      >
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
  testID,
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
      testID={testID}
      textInputType={textInputType}
      onSetFile={path => onSetInput('file', path)}
      onChangeText={text => onSetInput('text', text)}
    />
  )

export const DragAndDrop = ({allowFolders, children, inProgress, onAttach, prompt, testID}: DragAndDropProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} testID={testID}>
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
  const insets = Kb.useSafeAreaInsets()
  const keyboardVisible = useKeyboardState(s => s.isVisible)
  const androidOffset = React.useMemo(() => ({closed: -insets.bottom, opened: 0}), [insets.bottom])
  const onClick = () => {
    blurCBRef?.current()
    setTimeout(() => {
      onRun()
    }, 100)
  }

  if (!isMobile) return null

  const bar = (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      gap={Kb.Styles.isTablet ? 'small' : 'tiny'}
      alignItems="flex-start"
      padding="small"
      style={styles.inputActionsBarContainer}
    >
      {children}
      <Kb.WaitingButton
        mode="Primary"
        waitingKey={C.waitingKeyCrypto}
        label={runLabel}
        fullWidth={true}
        onClick={onClick}
        testID={TestIDs.CRYPTO_RUN_BUTTON}
      />
    </Kb.Box2>
  )

  // These screens draw edge-to-edge and the bar sticks to the keyboard. On phones it
  // must clear the home indicator; on tablet the screen lives inside the tab navigator,
  // so the real bottom inset also includes the native tab bar. useSafeAreaInsets only
  // reports the home indicator, so on iOS read the true native inset via RNScreens'
  // SafeAreaView (the tab controller adjusts it). Collapse the inset while the keyboard
  // is up: it covers the home indicator and the sticky view already lifts the bar above
  // it. Android already insets the whole tab/stack screen, so just offset for the home
  // indicator as before.
  if (isIOS) {
    // RNScreens applies the bottom inset as margin (outside the SafeAreaView's box). Wrap it
    // in a bar-colored Box2: a flex container includes its child's margin in its own height,
    // so the bar color fills down to the screen edge instead of leaving a white strip below
    // the bar (modern iPad has only a ~20pt home-indicator inset here; old iPad's inset also
    // includes the native bottom tab bar, which sits over this colored area).
    return (
      <KeyboardStickyView>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.stickyBarSafeArea}>
          <ScreensSafeAreaView edges={{bottom: !keyboardVisible}} style={[styles.stickyBarSafeArea, unsetLibFlex]}>
            {bar}
          </ScreensSafeAreaView>
        </Kb.Box2>
      </KeyboardStickyView>
    )
  }

  return <KeyboardStickyView offset={androidOffset}>{bar}</KeyboardStickyView>
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
      input: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.black,
        },
        isMobile: {
          ...Kb.Styles.globalStyles.fullHeight,
        },
      }),
      inputActionsBarContainer: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
      },
      // RNScreens' SafeAreaView forces flex: 1; neutralize it so the bar wraps its
      // content height instead of stretching inside the keyboard sticky view.
      stickyBarSafeArea: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        flexBasis: 'auto',
        flexGrow: 0,
        flexShrink: 0,
      },
      inputAndFilePickerContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, 0, 0, Kb.Styles.globalMargins.tiny),
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
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
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
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall),
        },
      }),
    }) as const
)
