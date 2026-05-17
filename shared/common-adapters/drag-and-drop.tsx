import * as React from 'react'
import * as C from '@/constants'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import logger from '@/logger'
import type {Props} from './drag-and-drop.shared'
import KB2 from '@/util/electron'

const {isDirectory, getPathForFile} = KB2.functions

type DragEvent = {
  dataTransfer: {
    types: Array<string>
    files: {length: number; [n: number]: File}
    dropEffect: string
  }
}

const DragAndDrop = (props: Props): React.ReactNode => {
  const [showDropOverlay, setShowDropOverlay] = React.useState(false)

  if (isMobile) {
    return props.children ?? null
  }

  const _onDrop = (e: DragEvent) => {
    const f = async () => {
      if (!_validDrag(e)) return
      const fileList = e.dataTransfer.files
      const paths: Array<string> = fileList.length
        ? Array.from({length: fileList.length}, (_, i) => getPathForFile?.(fileList[i] as File) ?? '')
        : []
      if (paths.length) {
        if (!props.allowFolders) {
          for (const path of paths) {
            try {
              const isDir = await (isDirectory?.(path) ?? Promise.resolve(false))
              if (isDir) {
                setShowDropOverlay(false)
                return
              }
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

  const _validDrag = (e: DragEvent) =>
    e.dataTransfer.types.includes('Files') && !props.disabled

  const _onDragOver = (e: DragEvent) => {
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
      onDrop={_onDrop as never}
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
      onDragOver={_onDragOver as never}
      style={Styles.collapseStyles([styles.containerStyle, props.containerStyle])}
    >
      {props.children}
      {showDropOverlay && _dropOverlay()}
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
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
}))

export default DragAndDrop
