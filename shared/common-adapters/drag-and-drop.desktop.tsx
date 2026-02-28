import * as React from 'react'
import * as C from '@/constants'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import logger from '@/logger'
import type {Props} from './drag-and-drop'
import KB2 from '@/util/electron.desktop'

const {isDirectory, getPathForFile} = KB2.functions

const DragAndDrop = (props: Props) => {
  const [showDropOverlay, setShowDropOverlay] = React.useState(false)

  const _onDrop = (e: React.DragEvent) => {
    const f = async () => {
      if (!_validDrag(e)) return
      const fileList = e.dataTransfer.files
      const paths: Array<string> = fileList.length
        ? Array.from(fileList).map(f => getPathForFile?.(f) ?? '')
        : []
      if (paths.length) {
        if (!props.allowFolders) {
          for (const path of paths) {
            // Check if any file is a directory and bail out if not
            try {
              const isDir = await (isDirectory?.(path) ?? Promise.resolve(false))
              if (isDir) {
                // TODO show a red error banner on failure: https://zpl.io/2jlkMLm
                setShowDropOverlay(false)
                return
              }
              // delegate to handler for any errors
            } catch (error) {
              logger.warn(`Error stating dropped attachment: ${String(error)}`)
            }
          }
        }
        props.onAttach?.(paths)
      }
      setShowDropOverlay(false)
    }
    C.ignorePromise(f())
  }

  const _validDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files') && !props.disabled

  const _onDragOver = (e: React.DragEvent) => {
    if (_validDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
      setShowDropOverlay(true)
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  const _onDragLeave = () => {
    setShowDropOverlay(false)
  }

  const _dropOverlay = () => (
    <Box2
      alignSelf="stretch"
      centerChildren={true}
      direction="horizontal"
      onDragLeave={_onDragLeave}
      onDrop={_onDrop}
      style={styles.dropOverlay}
    >
      <Box2 direction="vertical" centerChildren={true} gap="medium">
        {props.rejectReason ? (
          <Icon type="iconfont-remove" color={Styles.globalColors.red} sizeType="Huge" />
        ) : (
          <Icon type="iconfont-upload" color={Styles.globalColors.blue} sizeType="Huge" />
        )}
        {props.rejectReason ? (
          <Text type="Header">{props.rejectReason}</Text>
        ) : (
          <Text type="Header">{props.prompt || 'Drop files to upload'}</Text>
        )}
      </Box2>
    </Box2>
  )

  return (
    <Box2
      direction="vertical"
      fullHeight={props.fullHeight}
      fullWidth={props.fullWidth}
      onDragOver={_onDragOver}
      style={Styles.collapseStyles([styles.containerStyle, props.containerStyle])}
    >
      {props.children}
      {showDropOverlay && _dropOverlay()}
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      containerStyle: {
        position: 'relative',
      },
      dropOverlay: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.fillAbsolute,
          backgroundImage: `linear-gradient(${Styles.globalColors.white_75}, ${Styles.globalColors.white})`,
          padding: Styles.globalMargins.large,
        },
      }),
      icon: {
        position: 'relative',
        top: 2,
      },
      iconContainer: {
        backgroundColor: Styles.globalColors.blue,
        borderRadius: 100,
        height: 48,
        width: 48,
      },
    }) as const
)

export default DragAndDrop
