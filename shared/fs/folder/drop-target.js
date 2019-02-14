// @flow
import * as React from 'react'
import {Box, Icon} from '../../common-adapters'
import * as Styles from '../../styles'
import {isMobile} from '../../constants/platform'

type State = {|
  showDropOverlay: boolean,
|}

type Props = {
  children: React.Node,
  onAttach: ?(Array<string>) => void,
}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Box style={styles.dropOverlayStyle} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Icon type="icon-dropping-file-48" />
  </Box>
)

class DropTarget extends React.PureComponent<Props, State> {
  state = {showDropOverlay: false}

  _onDrop = e => {
    if (!this._validDrag(e) || !this.props.onAttach) {
      return
    }
    // Note that fileList is a FileList object - not an Array.
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
    this.props.onAttach(paths)
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
    if (isMobile || !onAttach) return children
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

export default (isMobile ? ({children}: Props) => children : DropTarget)
