import * as React from 'react'
import fs from 'fs'
import * as Styles from '../styles'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import {Props} from './drag-and-drop'
import logger from '../logger'

type OverlayProps = {
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

const DropOverlay = (props: OverlayProps) => (
  <Box2
    centerChildren={true}
    direction="horizontal"
    onDragLeave={props.onDragLeave}
    onDrop={props.onDrop}
    style={styles.dropOverlay}
  >
    <Box2 direction="vertical" centerChildren={true} gap="small">
      <Box2 direction="horizontal" style={styles.iconContainer} centerChildren={true}>
        <Icon type="iconfont-arrow-full-up" color={Styles.globalColors.white} style={styles.icon} />
      </Box2>
      <Text type="Header">Drop files to upload</Text>
    </Box2>
  </Box2>
)

type State = {
  showDropOverlay: boolean
}

class DragAndDrop extends React.PureComponent<Props, State> {
  state = {showDropOverlay: false}

  _onDrop = e => {
    if (!this._validDrag(e)) return
    const fileList = e.dataTransfer.files
    const paths: Array<string> = fileList.length
      ? (Array.prototype.map.call(fileList, f => f.path) as any)
      : []
    if (paths.length) {
      if (!this.props.allowFolders) {
        for (let path of paths) {
          // Check if any file is a directory and bail out if not
          try {
            // We do this synchronously
            // in testing, this is instantaneous
            // even when dragging many files
            const stat = fs.lstatSync(path)
            if (stat.isDirectory()) {
              // TODO show a red error banner on failure: https://zpl.io/2jlkMLm
              this.setState({showDropOverlay: false})
              return
            }
            // delegate to handler for any errors
          } catch (e) {
            logger.warn(`Error stating dropped attachment: ${e.code}`)
          }
        }
      }
      this.props.onAttach && this.props.onAttach(paths)
    }
    this.setState({showDropOverlay: false})
  }

  _validDrag = e => e.dataTransfer.types.includes('Files')

  _onDragOver = e => {
    if (this._validDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
      this.setState({showDropOverlay: true})
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  _onDragLeave = () => {
    this.setState({showDropOverlay: false})
  }

  render() {
    return (
      <Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        onDragOver={this._onDragOver}
        style={styles.containerStyle}
      >
        {this.props.children}
        {this.state.showDropOverlay && <DropOverlay onDragLeave={this._onDragLeave} onDrop={this._onDrop} />}
      </Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  containerStyle: {
    position: 'relative',
  },
  dropOverlay: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      backgroundImage: `linear-gradient(${Styles.globalColors.white_75}, ${Styles.globalColors.white})`,
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
})

export default DragAndDrop
