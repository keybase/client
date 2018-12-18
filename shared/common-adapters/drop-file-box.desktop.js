// @flow
import * as React from 'react'
import fs from 'fs'
import logger from '../logger'
import Icon from './icon'
import {Box, Box2} from './box'
import {globalStyles, globalColors} from '../styles'

type State = {|
  showDropOverlay: boolean,
|}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Box style={dropOverlayStyle} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Icon type="icon-dropping-file-48" />
  </Box>
)

class DropFileBox extends React.Component<any, State> {
  state = {showDropOverlay: false}

  _onDrop = e => {
    if (!this._validDrag(e)) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
    if (paths.length) {
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
      this.props.onAttach(paths)
    }
    this.setState({showDropOverlay: false})
  }

  _validDrag = e => Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')

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
    const {children, onAttach, ...otherProps} = this.props
    return (
      <Box2 style={containerStyle} onDragOver={onAttach ? this._onDragOver : null} {...otherProps}>
        {children}
        {this.state.showDropOverlay && <DropOverlay onDragLeave={this._onDragLeave} onDrop={this._onDrop} />}
      </Box2>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
}

const dropOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue_60,
  bottom: 0,
  flex: 1,
  justifyContent: 'center',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export default DropFileBox
