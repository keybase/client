import * as React from 'react'
import * as Constants from '../constants/crypto'
import * as FsConstants from '../constants/fs'
// import type * as Types from '../constants/types/crypto'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platform from '../constants/platform'
import type {IconType} from '../common-adapters/icon.constants-gen'
// import capitalize from 'lodash/capitalize'
import {pickFiles} from '../util/pick-files'

type TextProps = {
  onChangeText: (text: string) => void
  onSetFile: (path: string) => void
  value: string
  textIsCipher: boolean
  // ['decrypt', 'cipher'],
  // ['encrypt', 'plain'],
  // ['sign', 'plain'],
  // ['verify', 'cipher'],
  placeholder: string
  // [
  //   'decrypt',
  //   Platform.isMobile ? 'Enter text to decrypt' : 'Enter ciphertext, drop an encrypted file or folder, or',
  // ],
  // ['encrypt', Platform.isMobile ? 'Enter text to encrypt' : 'Enter text, drop a file or folder, or'],
  // ['sign', Platform.isMobile ? 'Enter text to sign' : 'Enter text, drop a file or folder, or'],
  // [
  //   'verify',
  //   Platform.isMobile ? 'Enter text to verify' : 'Enter a signed message, drop a signed file or folder, or',
  // ],
  // Tese magic numbers set the width of the single line `textarea` such that the
  // placeholder text is visible and pushes the "browse" button far enough to the
  // right to be exactly one empty character with from the end of the placeholder text
  emptyWidth: number // TODO remove this
  // [Constants.Operations.Encrypt]: 207,
  // [Constants.Operations.Decrypt]: 320,
  // [Constants.Operations.Sign]: 207,
  // [Constants.Operations.Verify]: 342,
}

type FileProps = {
  path: string
  size?: number
  onClearFiles: () => void
  fileIcon: IconType
  // ['decrypt', 'icon-file-saltpack-64'],
  // ['encrypt', 'icon-file-64'],
  // ['sign', 'icon-file-64'],
  // ['verify', 'icon-file-saltpack-64'],
}

type RunOperationProps = {
  children?: React.ReactNode
}

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
  const {value, onChangeText, onSetFile, textIsCipher, placeholder, emptyWidth} = props

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
    const path = filePaths[0]
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
            textType={textIsCipher ? 'Terminal' : 'Body'}
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

export const FileInput = (props: FileProps) => {
  const {path, size, fileIcon} = props
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
// type InputProps = {
//   input: string
//   inputType: 'file' | 'text'
//   updateText: (s: string) => void
//   updateFile: (f: string) => void
// }
// export const Input = (props: InputProps) => {
//   const {input, inputType, updateText, updateFile} = props
//   // const inputType = Container.useSelector(state => state.crypto[operation].inputType)

//   const [inputValue, setInputValue] = React.useState(input)

//   // const setInput = Container.useThrottledCallback(
//   //   Constants.useState(s => s.dispatch.setInput),
//   //   100
//   // )
//   const onChangeText = React.useCallback(
//     (text: string) => {
//       setInputValue(text)
//       updateText(text)
//       // setInput(operation, 'text', text)
//     },
//     [updateText]
//   )

//   const onSetFile = updateFile
//   const onClearFiles = React.useCallback(() => {
//     setInputValue('')
//     updateFile('')
//   }, [updateFile])
//   // const clearInput = Constants.useState(s => s.dispatch.clearInput)
//   // const onClearInput = React.useCallback(() => {
//   //   clearInput(operation)
//   // }, [operation, clearInput])

//   return inputType === 'file' ? (
//     <FileInput path={input} onClearFiles={onClearFiles} />
//   ) : (
//     <TextInput value={inputValue} onSetFile={onSetFile} onChangeText={onChangeText} />
//   )
// }

// const allowInputFolders = new Map([
//   ['decrypt', false],
//   ['encrypt', true],
//   ['sign', true],
//   ['verify', false],
// ] as const)

type DragAndDropProps = {
  allowFolders: boolean
  prompt: string
  inProgress: boolean
  children: React.ReactNode
  setFile: (f: string) => void
}

export const DragAndDrop = (props: DragAndDropProps) => {
  const {prompt, children, inProgress, setFile, allowFolders} = props

  const onAttach = React.useCallback(
    (localPaths: Array<string>) => {
      setFile(localPaths[0])
    },
    [setFile]
  )

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
type BannerProps = {
  infoMessage: string
  warningMessage: string
  errorMessage: string
}

export const OperationBanner = (props: BannerProps) => {
  const {warningMessage, errorMessage, infoMessage} = props

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
  return null
  // const {operation, children} = props
  // const waitingKey = Constants.waitingKey

  // const operationTitle = capitalize(operation)
  // const runTextOperation = Constants.useState(s => s.dispatch.runTextOperation)

  // const onRunOperation = () => {
  //   runTextOperation(operation)
  // }

  // return Styles.isMobile ? (
  //   <Kb.Box2
  //     direction="vertical"
  //     fullWidth={true}
  //     gap={Styles.isTablet ? 'small' : 'tiny'}
  //     style={styles.inputActionsBarContainer}
  //   >
  //     {children}
  //     <Kb.WaitingButton
  //       mode="Primary"
  //       waitingKey={waitingKey}
  //       label={operationTitle}
  //       fullWidth={true}
  //       onClick={onRunOperation}
  //     />
  //   </Kb.Box2>
  // ) : null
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
    } as const)
)
