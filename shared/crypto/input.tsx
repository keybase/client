import * as C from '../constants'
import * as React from 'react'
import * as Constants from '../constants/crypto'
import * as FsConstants from '../constants/fs'
import type * as T from '../constants/types'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platform from '../constants/platform'
import type {IconType} from '../common-adapters/icon.constants-gen'
import capitalize from 'lodash/capitalize'
import {pickFiles} from '../util/pick-files'
import shallowEqual from 'shallowequal'

type CommonProps = {
  operation: T.Crypto.Operations
}

type TextProps = CommonProps & {
  onChangeText: (text: string) => void
  onSetFile: (path: string) => void
  value: string
}

type FileProps = CommonProps & {
  path: string
  size?: number
  onClearFiles: () => void
}

type DragAndDropProps = CommonProps & {
  prompt: string
  children: React.ReactNode
}

type RunOperationProps = CommonProps & {
  children?: React.ReactNode
}

// Tese magic numbers set the width of the single line `textarea` such that the
// placeholder text is visible and pushes the "browse" button far enough to the
// right to be exactly one empty character with from the end of the placeholder text
const operationToEmptyInputWidth = {
  [Constants.Operations.Encrypt]: 207,
  [Constants.Operations.Decrypt]: 320,
  [Constants.Operations.Sign]: 207,
  [Constants.Operations.Verify]: 342,
}

const inputTextType = new Map([
  ['decrypt', 'cipher'],
  ['encrypt', 'plain'],
  ['sign', 'plain'],
  ['verify', 'cipher'],
] as const)
const inputPlaceholder = new Map([
  [
    'decrypt',
    Platform.isMobile ? 'Enter text to decrypt' : 'Enter ciphertext, drop an encrypted file or folder, or',
  ],
  ['encrypt', Platform.isMobile ? 'Enter text to encrypt' : 'Enter text, drop a file or folder, or'],
  ['sign', Platform.isMobile ? 'Enter text to sign' : 'Enter text, drop a file or folder, or'],
  [
    'verify',
    Platform.isMobile ? 'Enter text to verify' : 'Enter a signed message, drop a signed file or folder, or',
  ],
] as const)

/*
 * Before user enters text:
 *  - Single line input
 *  - Browse file button
 *
 * Afte user enters text:
 *  - Multiline input
 *  - Clear button
 */
export const TextInput = (props: TextProps) => {
  const {value, operation, onChangeText, onSetFile} = props
  const textType = inputTextType.get(operation)
  const placeholder = inputPlaceholder.get(operation)
  const emptyWidth = operationToEmptyInputWidth[operation]

  // When 'browse file' is show, focus input by clicking anywhere in the input box
  // (despite the input being one line tall)
  const inputRef = React.useRef<Kb.PlainInput>(null)
  const onFocusInput = () => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus()
    }
  }

  const onOpenFile = async () => {
    // On Windows and Linux only files will be able to be selected. Their native pickers don't allow for selecting both directories and files at once.
    // To set a directory as input, a user will need to drag the directory into Keybase.
    const filePaths = await pickFiles({
      allowDirectories: Platform.isDarwin,
      buttonLabel: 'Select',
    })
    if (!filePaths.length) return
    const path = filePaths[0]!
    onSetFile(path)
  }

  // Styling
  const rowsMax = Styles.isMobile ? undefined : value ? undefined : 1
  const growAndScroll = !Styles.isMobile
  const inputStyle = Styles.collapseStyles([
    styles.input,
    value ? styles.inputFull : styles.inputEmpty,
    !value && !Styles.isMobile && {width: emptyWidth},
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
    <Kb.Box onClick={onFocusInput} style={styles.containerInputFocus}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.commonContainer}>
        <Kb.Box2
          direction={Styles.isMobile ? 'vertical' : 'horizontal'}
          alignItems="flex-start"
          alignSelf="flex-start"
          fullWidth={Styles.isMobile || !!value}
          fullHeight={Styles.isMobile || !!value}
          style={styles.inputAndFilePickerContainer}
        >
          <Kb.NewInput
            value={value}
            placeholder={placeholder}
            multiline={true}
            autoFocus={true}
            allowKeyboardEvents={true}
            hideBorder={true}
            rowsMax={rowsMax}
            growAndScroll={growAndScroll}
            padding="tiny"
            containerStyle={inputContainerStyle}
            style={inputStyle}
            textType={textType === 'cipher' ? 'Terminal' : 'Body'}
            autoCorrect={textType !== 'cipher'}
            spellCheck={textType !== 'cipher'}
            onChangeText={onChangeText}
            ref={inputRef}
          />
          {!Styles.isMobile && browseButton}
        </Kb.Box2>
      </Kb.Box2>
      {!Styles.isMobile && clearButton}
    </Kb.Box>
  )
}

const inputFileIcon = new Map([
  ['decrypt', 'icon-file-saltpack-64'],
  ['encrypt', 'icon-file-64'],
  ['sign', 'icon-file-64'],
  ['verify', 'icon-file-saltpack-64'],
] as const)

export const FileInput = (props: FileProps) => {
  const {path, size, operation} = props
  const fileIcon = inputFileIcon.get(operation) as IconType
  const waiting = Container.useAnyWaiting(Constants.waitingKey)

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
          <Kb.Icon type={fileIcon} sizeType="Huge" />
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySemibold">{path}</Kb.Text>
            {size ? (
              <Kb.Text type="BodySmallSemibold">{FsConstants.humanReadableFileSize(size)}</Kb.Text>
            ) : null}
          </Kb.Box2>
        </Kb.Box2>
        {path && !waiting && (
          <Kb.Box2 direction="vertical" style={styles.clearButtonInput}>
            <Kb.Text
              type="BodySmallPrimaryLink"
              onClick={() => props.onClearFiles()}
              style={styles.clearButtonInput}
            >
              Clear
            </Kb.Text>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

export const Input = (props: CommonProps) => {
  const {operation} = props

  const {input: _input, inputType} = C.useCryptoState(s => {
    const o = s[operation]
    const {input, inputType} = o
    return {input, inputType}
  }, shallowEqual)
  const input = _input.stringValue()

  const [inputValue, setInputValue] = React.useState(input)

  const setInput = C.useCryptoState(s => s.dispatch.setInput)
  const clearInput = C.useCryptoState(s => s.dispatch.clearInput)

  const onSetInput = (type: T.Crypto.InputTypes, newValue: string) => {
    setInput(operation, type, newValue)
  }
  const onClearInput = () => {
    clearInput(operation)
  }

  return inputType === 'file' ? (
    <FileInput
      operation={operation}
      path={input}
      onClearFiles={() => {
        setInputValue('')
        onClearInput()
      }}
    />
  ) : (
    <TextInput
      operation={operation}
      value={inputValue}
      onSetFile={path => {
        onSetInput('file', path)
      }}
      onChangeText={text => {
        setInputValue(text)
        onSetInput('text', text)
      }}
    />
  )
}

const allowInputFolders = new Map([
  ['decrypt', false],
  ['encrypt', true],
  ['sign', true],
  ['verify', false],
] as const)

export const DragAndDrop = (props: DragAndDropProps) => {
  const {prompt, children, operation} = props
  const inProgress = C.useCryptoState(s => s[operation].inProgress)
  const setInput = C.useCryptoState(s => s.dispatch.setInput)

  const onAttach = (localPaths: Array<string>) => {
    const path = localPaths[0]
    setInput(operation, 'file', path ?? '')
  }

  const allowFolders = allowInputFolders.get(operation) as boolean

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.DragAndDrop
        disabled={inProgress}
        allowFolders={allowFolders}
        fullHeight={true}
        fullWidth={true}
        onAttach={onAttach}
        prompt={prompt}
      >
        {children}
      </Kb.DragAndDrop>
    </Kb.Box2>
  )
}

export const OperationBanner = (props: CommonProps) => {
  const {operation} = props
  const infoMessage = Constants.infoMessage[operation]

  const {errorMessage: _errorMessage, warningMessage: _warningMessage} = C.useCryptoState(s => {
    const {errorMessage, warningMessage} = s[operation]
    return {errorMessage, warningMessage}
  }, shallowEqual)
  const errorMessage = _errorMessage.stringValue()
  const warningMessage = _warningMessage.stringValue()

  if (!errorMessage && !warningMessage && infoMessage) {
    return (
      <Kb.Banner color="grey">
        <Kb.BannerParagraph bannerColor="grey" content={infoMessage} />
      </Kb.Banner>
    )
  }

  return (
    <>
      {errorMessage ? (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content={errorMessage} />
        </Kb.Banner>
      ) : null}
      {warningMessage ? (
        <Kb.Banner color="yellow">
          <Kb.BannerParagraph bannerColor="yellow" content={warningMessage} />
        </Kb.Banner>
      ) : null}
    </>
  )
}

// Mobile only
export const InputActionsBar = (props: RunOperationProps) => {
  const {operation, children} = props
  const waitingKey = Constants.waitingKey
  const operationTitle = capitalize(operation)
  const runTextOperation = C.useCryptoState(s => s.dispatch.runTextOperation)
  const onRunOperation = () => {
    runTextOperation(operation)
  }

  return Styles.isMobile ? (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      gap={Styles.isTablet ? 'small' : 'tiny'}
      style={styles.inputActionsBarContainer}
    >
      {children}
      <Kb.WaitingButton
        mode="Primary"
        waitingKey={waitingKey}
        label={operationTitle}
        fullWidth={true}
        onClick={onRunOperation}
      />
    </Kb.Box2>
  ) : null
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      browseFile: {
        flexShrink: 0,
      },
      clearButtonInput: {
        alignSelf: 'flex-start',
        flexShrink: 1,
        padding: Styles.globalMargins.tiny,
      },
      commonContainer: {
        ...Styles.globalStyles.flexGrow,
        ...Styles.globalStyles.positionRelative,
      },
      containerInputFocus: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexGrow,
          ...Styles.globalStyles.fullHeight,
          display: 'flex',
        },
        isMobile: {
          flexShrink: 1,
          // Give space on mobile for Recipients divider
          marginTop: 1,
        },
      }),
      fileContainer: {
        alignSelf: 'flex-start',
        ...Styles.padding(Styles.globalMargins.small),
      },
      hidden: {
        display: 'none',
      },
      input: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
        },
        isMobile: {
          ...Styles.globalStyles.fullHeight,
        },
      }),
      inputActionsBarContainer: Styles.platformStyles({
        isMobile: {
          ...Styles.padding(Styles.globalMargins.small),
          alignItems: 'flex-start',
          backgroundColor: Styles.globalColors.blueGrey,
        },
      }),
      inputAndFilePickerContainer: Styles.platformStyles({
        isElectron: {
          paddingBottom: 0,
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: 0,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      inputContainer: Styles.platformStyles({
        isElectron: {
          // We want the immediate container not to overflow, so we tell it be height: 100% to match the parent
          ...Styles.globalStyles.fullHeight,
          alignItems: 'stretch',
          padding: 0,
        },
        isMobile: {
          ...Styles.globalStyles.fullHeight,
          ...Styles.padding(0),
        },
      }),
      inputContainerEmpty: Styles.platformStyles({
        isElectron: {
          ...Styles.padding(0),
        },
        isMobile: {
          ...Styles.globalStyles.fullHeight,
          ...Styles.padding(0),
        },
      }),
      inputEmpty: Styles.platformStyles({
        isElectron: {
          ...Styles.padding(0),
          minHeight: 'initial',
          overflowY: 'hidden',
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          paddingTop: Styles.globalMargins.xsmall,
        },
      }),
      inputFull: Styles.platformStyles({
        common: {
          ...Styles.padding(0),
        },
        isElectron: {
          paddingRight: 46,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.xsmall,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          paddingTop: Styles.globalMargins.xsmall,
        },
      }),
    }) as const
)
