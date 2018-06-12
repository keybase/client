// @flow
import * as React from 'react'
import fs from 'fs'
import logger from '../../logger'
import {Box, Button, ButtonBar, Icon, MaybePopup, Text, iconCastPlatformStyles} from '../../common-adapters'
import {EDIT_AVATAR_ZINDEX} from '../../constants/profile'
import {glamorous, globalColors, globalMargins, globalStyles, styleSheetCreate} from '../../styles'
import type {Props} from '.'

type State = {
  coords: Object,
  dragging: boolean,
  hasPreview: boolean,
  scale: number,
}

class EditAvatar extends React.Component<Props, State> {
  _file: ?HTMLInputElement
  _range: ?HTMLInputElement
  _image: ?HTMLImageElement

  constructor(props: Props) {
    super(props)
    this.state = {
      coords: {
        ox: 0,
        oy: 0,
        x: 0,
        y: 0,
      },
      dragging: false,
      hasPreview: false,
      scale: 0,
    }
  }

  _filePickerFiles = () => (this._file && this._file.files) || []

  _filePickerOpen = () => {
    this._file && this._file.click()
  }

  _filePickerSetRef = (r: ?HTMLInputElement) => {
    this._file = r
  }

  _filePickerSetValue = (value: string) => {
    if (this._file) this._file.value = value
  }

  _pickFile = () => {
    const fileList = this._filePickerFiles()
    const paths = fileList.length
      ? Array.prototype.map
          .call(fileList, (f: File) => {
            // We rely on path being here, even though it's
            // not part of the File spec.
            // $ForceType
            const path: string = f.path
            return path
          })
          .filter(Boolean)
      : []
    if (paths) {
      this._paintImage(paths.pop())
    }
    this._filePickerSetValue('')
  }

  _onDragLeave = e => {}

  _onDrop = e => {
    if (!this._validDrag(e)) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
    if (paths.length) {
      // TODO: Show an error when there's more than one path.
      for (let path of paths) {
        // Check if any file is a directory and bail out if not
        try {
          // We do this synchronously
          // in testing, this is instantaneous
          // even when dragging many files
          const stat = fs.lstatSync(path)
          if (stat.isDirectory()) {
            // TODO: Show a red error banner on failure: https://zpl.io/2jlkMLm
            return
          }
        } catch (e) {
          // TODO: Show a red error banner on failure: https://zpl.io/2jlkMLm
          logger.warn(`Error stating dropped avatar: ${e.code}`)
        }
      }
      this._paintImage(paths.pop())
    }
  }

  _validDrag = e => Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')

  _onDragOver = e => {
    if (this._validDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  _paintImage = (path: string) => {
    if (this._image) {
      this._image.onload = () => {
        this.setState({hasPreview: true})
      }
      this._image.src = path
    }
  }

  _imageSetRef = (r: ?HTMLImageElement) => {
    this._image = r
  }

  _rangeSetRef = (r: ?HTMLInputElement) => {
    this._range = r
  }

  _setScale = e => {
    this.setState({scale: e.target.value})

    if (this._image && this._image.style) {
      this._image.style.maxWidth = `${(1 + parseFloat(this.state.scale)) * 100}%`
    }
  }

  _onMouseDown = e => {
    this.setState({dragging: true})
    this.setState({
      coords: {
        ox: e.pageX,
        oy: e.pageY,
        x: e.target.offsetTop,
        y: e.target.offsetLeft,
        // x: this._image.offsetTop,
        // y: this._image.offsetLeft,
      },
    })
  }

  _onMouseUp = e => {
    this.setState({dragging: false})
  }

  _onMouseMove = e => {
    if (!this.state.dragging) return

    e.target.style.left = `${this.state.coords.x + e.pageX - this.state.coords.ox}px`
    e.target.style.top = `${this.state.coords.y + e.pageY - this.state.coords.oy}px`
    // this._image.style.left = `${this.state.coords.x + e.pageX - this.state.coords.ox}px`
    // this._image.style.top = `${this.state.coords.y + e.pageY - this.state.coords.oy}px`

    return false
  }

  _onSave = e => {
    console.log('saving...')
    this.props.onSave({filename: this._image.src})
  }

  render = () => {
    return (
      <MaybePopup onClose={this.props.onClose} styleCover={styles.popup}>
        <Box
          style={styles.container}
          onDragOver={this._onDragOver}
          onDragLeave={this._onDragLeave}
          onDrop={this._onDrop}
          onMouseUp={this._onMouseUp}
        >
          <Text type="BodyBig">Drag and drop a new profile image</Text>
          <Text type="BodyPrimaryLink" onClick={this._filePickerOpen}>
            or browse your computer for one
          </Text>
          <HoverBox onClick={this._filePickerOpen}>
            <input
              type="file"
              style={styles.hidden}
              ref={this._filePickerSetRef}
              onChange={this._pickFile}
              multiple={false}
            />
            <img
              style={styles.image}
              ref={this._imageSetRef}
              onDragStart={e => e.preventDefault()}
              onMouseDown={this._onMouseDown}
              onMouseMove={this._onMouseMove}
            />
            {!this.state.hasPreview && (
              <Icon
                className="icon"
                type="iconfont-camera"
                fontSize={48}
                style={iconCastPlatformStyles(styles.icon)}
              />
            )}
          </HoverBox>
          <input
            style={styles.slider}
            type="range"
            value={this.state.scale}
            min={0}
            max={1}
            step={0.001}
            ref={this._rangeSetRef}
            onChange={this._setScale}
            disabled={!this.state.hasPreview}
          />
          <ButtonBar>
            <Button type="Secondary" onClick={this.props.onClose} label="Cancel" />
            <Button type="Primary" onClick={this._onSave} label="Save" disabled={!this.state.hasPreview} />
          </ButtonBar>
        </Box>
      </MaybePopup>
    )
  }
}

const HoverBox = glamorous(Box)({
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.lightGrey2,
  borderColor: globalColors.grey,
  borderRadius: 128,
  borderStyle: 'dashed',
  borderWidth: 5,
  cursor: 'pointer',
  height: 128,
  marginBottom: globalMargins.small,
  marginTop: globalMargins.medium,
  overflow: 'hidden',
  position: 'relative',
  width: 128,
  ':hover': {
    backgroundColor: globalColors.blue_30,
    borderColor: globalColors.blue_60,
  },
  ':hover .icon': {
    color: globalColors.blue_60,
  },
})

const styles = styleSheetCreate({
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    minWidth: 460,
    paddingBottom: globalMargins.xlarge,
    paddingTop: globalMargins.xlarge,
  },
  hidden: {
    display: 'none',
  },
  icon: {
    left: '50%',
    marginLeft: -24,
    marginTop: -21,
    position: 'absolute',
    top: '50%',
  },
  image: {
    alignSelf: 'center',
    maxWidth: '100%',
    minWidth: '100%',
    position: 'relative',
  },
  popup: {
    zIndex: EDIT_AVATAR_ZINDEX,
  },
})

export default EditAvatar
