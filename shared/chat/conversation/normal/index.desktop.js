// @flow
import * as React from 'react'
import fs from 'fs'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import logger from '../../../logger'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'
import type {Props} from './index.types'
import '../conversation.css'

type State = {|
  showDropOverlay: boolean,
|}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Kb.Box direction="horizontal" style={styles.dropOverlay} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Kb.Box2 direction="vertical" centerChildren={true} gap="small">
      <Kb.Icon type="icon-file-uploading-48" />
      <Kb.Text type="Header">Drop files to upload</Kb.Text>
    </Kb.Box2>
  </Kb.Box>
)

const Offline = () => (
  <Kb.Box style={styles.offline}>
    <Kb.Text type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Kb.Text>
  </Kb.Box>
)

class Conversation extends React.PureComponent<Props, State> {
  _mounted = false
  state = {showDropOverlay: false}

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidMount() {
    this._mounted = true
  }

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

  _onPaste = e => {
    readImageFromClipboard(e, () => {
      this._mounted && this.setState({showDropOverlay: true})
    }).then(clipboardData => {
      this._mounted && this.setState({showDropOverlay: false})
      if (clipboardData) {
        this.props.onPaste(clipboardData)
      }
    })
  }

  render() {
    return (
      <Kb.Box
        className="conversation"
        style={styles.container}
        onDragOver={this._onDragOver}
        onPaste={this._onPaste}
      >
        {this.props.threadLoadedOffline && <Offline />}
        <HeaderArea
          isPending={this.props.isPending}
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.props.showLoader && <Kb.LoadingLine />}
        <ListArea
          isPending={this.props.isPending}
          onFocusInput={this.props.onFocusInput}
          scrollListDownCounter={this.props.scrollListDownCounter}
          scrollListUpCounter={this.props.scrollListUpCounter}
          conversationIDKey={this.props.conversationIDKey}
        />
        <Banner conversationIDKey={this.props.conversationIDKey} />
        <InputArea
          isPending={this.props.isPending}
          focusInputCounter={this.props.focusInputCounter}
          onRequestScrollDown={this.props.onRequestScrollDown}
          onRequestScrollUp={this.props.onRequestScrollUp}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.state.showDropOverlay && <DropOverlay onDragLeave={this._onDragLeave} onDrop={this._onDrop} />}
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
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
  offline: {
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.black_10,
    flex: 1,
    maxHeight: Styles.globalMargins.medium,
  },
})

export default Conversation
