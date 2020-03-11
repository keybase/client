import * as React from 'react'
import * as CryptoGen from '../../actions/crypto-gen'
import * as Constants from '../../constants/crypto'
import * as FsConstants from '../../constants/fs'
import * as Types from '../../constants/types/crypto'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import HiddenString from '../../util/hidden-string'

const {electron} = KB
const {showOpenDialog} = electron.dialog

type InputProps = {
  operation: Types.Operations
}

type TextProps = {
  onChangeText: (text: string) => void
  onSetFile: (path: string) => void
  operation: Types.Operations
  value: string
}

type FileProps = {
  path: string
  size?: number
  operation: Types.Operations
  onClearFiles: () => void
}

type DragAndDropProps = {
  operation: Types.Operations
  prompt: string
  children: React.ReactNode
}

type OperationBannerProps = {
  operation: Types.Operations
  infoMessage?: string
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
  const textType = Constants.getInputTextType(operation)
  const placeholder = Constants.getInputPlaceholder(operation)
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
    const options = {
      allowDirectories: Platform.isDarwin,
      buttonLabel: 'Select',
    }
    const filePaths = await showOpenDialog(options)
    if (!filePaths) return
    const path = filePaths[0]
    onSetFile(path)
  }

  return (
    <Kb.Box onClick={onFocusInput} style={styles.containerInputFocus}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.commonContainer}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={!!value}
          fullHeight={!!value}
          alignItems="flex-start"
          alignSelf="flex-start"
          style={styles.inputAndFilePickerContainer}
        >
          <Kb.NewInput
            value={value}
            placeholder={placeholder}
            multiline={true}
            rowsMax={value ? undefined : 1}
            autoFocus={true}
            allowKeyboardEvents={true}
            hideBorder={true}
            growAndScroll={true}
            padding="tiny"
            containerStyle={value ? styles.inputContainer : styles.inputContainerEmpty}
            style={Styles.collapseStyles([
              styles.input,
              value ? styles.inputFull : styles.inputEmpty,
              !value && {width: emptyWidth},
            ])}
            textType={textType === 'cipher' ? 'Terminal' : 'Body'}
            placeholderTextType="Body"
            onChangeText={onChangeText}
            ref={inputRef}
          />
          {!value && (
            <Kb.Text type="BodyPrimaryLink" style={styles.browseFile} onClick={onOpenFile}>
              browse
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
      {value && (
        <Kb.Box2 direction="vertical" style={styles.clearButtonInput}>
          <Kb.Text type="BodySmallPrimaryLink" onClick={() => onChangeText('')}>
            Clear
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box>
  )
}

export const FileInput = (props: FileProps) => {
  const {path, size, operation} = props
  const fileIcon = Constants.getInputFileIcon(operation)
  const waitingKey = Constants.getFileWaitingKey(operation)
  const waiting = Container.useAnyWaiting(waitingKey)

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

export const Input = (props: InputProps) => {
  const {operation} = props
  const dispatch = Container.useDispatch()

  const input = Container.useSelector(state => state.crypto[operation].input.stringValue())
  const inputType = Container.useSelector(state => state.crypto[operation].inputType)

  const [inputValue, setInputValue] = React.useState(input)

  const onSetInput = (type: Types.InputTypes, newValue: string) => {
    dispatch(CryptoGen.createSetInput({operation, type, value: new HiddenString(newValue)}))
  }
  const onClearInput = () => {
    dispatch(CryptoGen.createClearInput({operation}))
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

export const DragAndDrop = (props: DragAndDropProps) => {
  const {prompt, children, operation} = props
  const dispatch = Container.useDispatch()

  const inProgress = Container.useSelector(store => store.crypto[operation].inProgress)

  const onAttach = (localPaths: Array<string>) => {
    const path = localPaths[0]
    dispatch(CryptoGen.createSetInput({operation, type: 'file', value: new HiddenString(path)}))
  }

  const allowFolders = Constants.getAllowInputFolders(props.operation)

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

export const OperationBanner = (props: OperationBannerProps) => {
  const {operation, infoMessage} = props
  const errorMessage = Container.useSelector(state => state.crypto[operation].errorMessage.stringValue())
  const warningMessage = Container.useSelector(state => state.crypto[operation].warningMessage.stringValue())

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
      containerInputFocus: {
        ...Styles.globalStyles.flexGrow,
        ...Styles.globalStyles.fullHeight,
        display: 'flex',
        flexShrink: 1.7,
      },
      fileContainer: {
        alignSelf: 'flex-start',
        ...Styles.padding(Styles.globalMargins.small),
      },
      hidden: {
        display: 'none',
      },
      input: {
        color: Styles.globalColors.black,
      },
      inputAndFilePickerContainer: {
        paddingBottom: 0,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: 0,
        paddingTop: Styles.globalMargins.tiny,
      },
      inputContainer: {
        // We want the immediate container not to overflow, so we tell it be height: 100% to match the parent
        ...Styles.globalStyles.fullHeight,
        alignItems: 'stretch',
        padding: 0,
      },
      inputContainerEmpty: {
        padding: 0,
      },
      inputEmpty: Styles.platformStyles({
        common: {
          ...Styles.padding(0),
          minHeight: 'initial',
        },
        isElectron: {
          overflowY: 'hidden',
        },
      }),
      inputFull: {
        padding: 0,
        paddingRight: 46,
      },
    } as const)
)
