import * as React from 'react'
import * as Constants from '../../constants/crypto'
import * as FsConstants from '../../constants/fs'
import * as Types from '../../constants/types/crypto'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type TextProps = {
  onChangeText: (text: string) => void
  onSetFile: (path: string) => void
  placeholder: string
  textType: Types.TextType
  operation: Types.Operations
  value: string
}

type FileProps = {
  path: string
  size?: number
  operation: Types.Operations
  onClearFiles: () => void
}

const operationToEmptyInputWidth = {
  [Constants.Operations.Encrypt]: 153,
  [Constants.Operations.Decrypt]: 266,
  [Constants.Operations.Sign]: 153,
  [Constants.Operations.Verify]: 288,
}

/*
 * Before user enters text:
 *  - Single line input
 *  - Browse file button
 *
 * Afte user enters text:
 *  - Multiline input
 */
const TextInput = (props: TextProps) => {
  const {value, placeholder, operation, onChangeText, onSetFile} = props
  const emptyWidth = operationToEmptyInputWidth[operation]

  // When 'browse file' is show, focus input by clicking anywhere in the input box
  // (despite the input being one line tall)
  const inputRef = React.useRef<Kb.PlainInput>(null)
  const onFocusInput = React.useCallback(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus()
    }
  }, [inputRef])

  // Handle native file browser via <input type='file' ... />
  const filePickerRef = React.useRef<HTMLInputElement>(null)
  const selectFile = React.useCallback(() => {
    const files = (filePickerRef && filePickerRef.current && filePickerRef.current.files) || []
    const allPaths: Array<string> = files.length
      ? Array.from(files)
          .map((f: File) => f.path)
          .filter(Boolean)
      : ([] as any)
    const path = allPaths.pop()
    // Set input type to 'file' and value to 'path'
    if (path) {
      onSetFile(path)
    }
  }, [filePickerRef, onSetFile])
  const openFilePicker = React.useCallback(() => {
    if (filePickerRef && filePickerRef.current) {
      filePickerRef.current.click()
    }
  }, [filePickerRef])

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
            hideBorder={true}
            growAndScroll={true}
            padding="tiny"
            containerStyle={value ? styles.inputContainer : styles.inputContainerEmpty}
            style={Styles.collapseStyles([
              styles.input,
              value ? styles.inputFull : styles.inputEmpty,
              !value && {width: emptyWidth},
            ])}
            onChangeText={onChangeText}
            ref={inputRef}
          />
          {!value && (
            <>
              <input
                type="file"
                accept="*"
                ref={filePickerRef}
                multiple={false}
                onChange={selectFile}
                style={styles.hidden}
              />
              <Kb.Text type="BodyPrimaryLink" onClick={openFilePicker} style={styles.browseFile}>
                browse for one
              </Kb.Text>
            </>
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

const FileInput = (props: FileProps) => {
  const {path, size, operation} = props
  const fileIcon = Constants.getInputFileIcon(operation)
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
        <Kb.Box2 direction="vertical" style={styles.clearButtonInput}>
          <Kb.Text
            type="BodySmallPrimaryLink"
            onClick={() => props.onClearFiles()}
            style={styles.clearButtonInput}
          >
            Clear
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
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
        flexShrink: 2,
      },
      containerInputFocus: {
        ...Styles.globalStyles.flexGrow,
        ...Styles.globalStyles.fullHeight,
        display: 'flex',
        flexShrink: 2,
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

export {TextInput, FileInput}
