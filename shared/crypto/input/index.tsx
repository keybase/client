import * as React from 'react'
import * as Constants from '../../constants/crypto'
import * as FsConstants from '../../constants/fs'
import * as Types from '../../constants/types/crypto'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type TextProps = {
  onChangeText: (text: string) => void
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

const TextInput = (props: TextProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.NewInput
        value={props.value}
        placeholder={props.placeholder}
        multiline={true}
        autoFocus={true}
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
  const {path, size, operation} = props
  const fileIcon = Constants.getInputFileIcon(operation)
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="stretch"
      style={styles.container}
    >
      <Kb.Text type="BodySmallPrimaryLink" onClick={() => props.onClearFiles()} style={styles.clearButton}>
        Clear
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.fileContainer}>
          <Kb.Icon type={fileIcon} sizeType="Huge" />
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySemibold">{path}</Kb.Text>
            {size ? (
              <Kb.Text type="BodySmallSemibold">{FsConstants.humanReadableFileSize(size)}</Kb.Text>
            ) : null}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      clearButton: {
        position: 'absolute',
        right: Styles.globalMargins.small,
        top: Styles.globalMargins.small,
      },
      container: {
        ...Styles.globalStyles.flexGrow,
        ...Styles.globalStyles.positionRelative,
      },
      fileContainer: {
        ...Styles.padding(Styles.globalMargins.small),
      },
      inputContainer: {
        // We want the immediate container not to overflow, so we tell it be height: 100% to match the parent
        ...Styles.globalStyles.fullHeight,
        alignItems: 'stretch',
        padding: 0,
      },
    } as const)
)

export {TextInput, FileInput}
