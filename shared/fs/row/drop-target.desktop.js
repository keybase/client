// @flow
import * as React from 'react'
import {Box, Icon} from '../../common-adapters'
import * as Styles from '../../styles'

type State = {|
  showDropOverlay: boolean,
|}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Box style={styles.dropOverlayStyle} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Icon type="icon-dropping-file-48" />
  </Box>
)

class DropTarget extends React.PureComponent<any, State> {
  state = {showDropOverlay: false}

  _onDrop = e => {
    if (!this._validDrag(e)) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
    this.props.onAttach(paths)
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
      <Box style={styles.containerStyle} onDragOver={onAttach ? this._onDragOver : null} {...otherProps}>
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
  dropOverlayStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blue_60,
    bottom: 0,
    flex: 1,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

export default DropTarget
