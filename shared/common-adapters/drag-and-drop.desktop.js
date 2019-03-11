// @flow
import * as React from 'react'
import fs from 'fs'
import * as Styles from '../styles'
import {Box, Box2} from './box'
import Icon from './icon'
import Text from './text'
import logger from '../logger'

type OverlayProps = {|
  onDragLeave: (e: SyntheticDragEvent<>) => void,
  onDrop: (e: SyntheticDragEvent<>) => void,
|}

const DropOverlay = (props: OverlayProps) => (
  <Box
    direction="horizontal"
    style={styles.dropOverlay}
    onDragLeave={props.onDragLeave}
    onDrop={props.onDrop}
  >
    <Box2 direction="vertical" centerChildren={true} gap="small">
      <Box2 direction="horizontal" style={styles.iconContainer} centerChildren={true}>
        <Icon type="iconfont-arrow-full-up" color={Styles.globalColors.white} style={styles.icon} />
      </Box2>
      <Text type="Header">Drop files to upload</Text>
    </Box2>
  </Box>
)

type State = {|
  showDropOverlay: boolean,
|}

type Props = {|
  allowFolders?: boolean,
  children: React.Node,
  onAttach: ?(Array<string>) => void,
|}

class DragAndDrop extends React.PureComponent<Props, State> {
  state = {showDropOverlay: false}

  _onDrop = e => {
    if (!this._validDrag(e) || !this.props.onAttach) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
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
      this.props.onAttach(paths)
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

  _onDragLeave = e => {
    this.setState({showDropOverlay: false})
  }

  render() {
    const {children, onAttach} = this.props
    if (Styles.isMobile || !onAttach) return children
    return (
      <Box style={styles.containerStyle} onDragOver={this._onDragOver}>
        {children}
        {this.state.showDropOverlay && <DropOverlay onDragLeave={this._onDragLeave} onDrop={this._onDrop} />}
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  containerStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    position: 'relative',
  },
  dropOverlay: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      alignSelf: 'center',
      backgroundImage: `linear-gradient(${Styles.globalColors.white_75}, ${Styles.globalColors.white})`,
      justifyContent: 'center',
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

export default (Styles.isMobile ? ({children}: Props) => children : DragAndDrop)
