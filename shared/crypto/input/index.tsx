import fs from 'fs'
import * as React from 'react'
import * as FsConstants from '../../constants/fs'
import * as Types from '../../constants/types/crypto'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type TextProps = {
  onChangeText: (text: string) => void
  placeholder: string
  textType: Types.TextType
  value: string
}

type FileProps = {
  path: string
  onClearFiles: () => void
  // Used for storybook
  isDir?: boolean
  size?: number
}

const TextInput = (props: TextProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.NewInput
        value={props.value}
        placeholder={props.placeholder}
        multiline={true}
        autoFocus={false}
        hideBorder={true}
        growAndScroll={true}
        padding="tiny"
        textType={props.textType === 'cipher' ? 'Terminal' : 'Body'}
        containerStyle={styles.inputContainer}
        style={{color: Styles.globalColors.black}}
        onChangeText={props.onChangeText}
      />
    </Kb.Box2>
  )
}

const FileInput = (props: FileProps) => {
  const {isDir, path, size} = props
  const [fileSize, setFileSize] = React.useState(0)
  const [isDirectory, setIsDirectory] = React.useState(false)
  React.useEffect(() => {
    try {
      // Storybook
      if (isDir) {
        setIsDirectory(true)
        setFileSize(0)
        return
      }
      const stat = fs.lstatSync(path)
      if (stat.isDirectory()) {
        setIsDirectory(true)
        setFileSize(0)
        return
      }
      setFileSize(stat.size)
    } catch (e) {
      setFileSize(size ?? 0)
    }
  }, [isDir, path, size])
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="stretch"
      style={styles.container}
    >
      <Kb.Text type="BodyPrimaryLink" onClick={() => props.onClearFiles()} style={styles.clearButton}>
        Clear
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.fileContainer}>
        <Kb.Icon type={isDirectory ? 'icon-folder-64' : 'icon-file-64'} />
        <Kb.Text type="BodySemibold">{props.path}</Kb.Text>
        {fileSize ? (
          <Kb.Text type="BodySmallSemibold">{FsConstants.humanReadableFileSize(fileSize)}</Kb.Text>
        ) : null}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      clearButton: {
        position: 'absolute',
        right: Styles.globalMargins.tiny,
        top: Styles.globalMargins.tiny,
      },
      container: {
        ...Styles.globalStyles.flexGrow,
        ...Styles.globalStyles.positionRelative,
      },
      fileContainer: {
        ...Styles.globalStyles.flexBoxCenter,
      },
      inputContainer: {
        // We want the immediate container not to overflow, so we tell it be height: 100% to match the parent
        ...Styles.globalStyles.fullHeight,
        alignItems: 'stretch',
      },
    } as const)
)

export {TextInput, FileInput}
