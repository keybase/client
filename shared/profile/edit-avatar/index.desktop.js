// @flow
import * as React from 'react'
import fs from 'fs'
import logger from '../../logger'
import {Box, Button, ButtonBar, Icon, MaybePopup, Text, iconCastPlatformStyles} from '../../common-adapters'
import {EDIT_AVATAR_ZINDEX} from '../../constants/profile'
import {glamorous, globalColors, globalMargins, globalStyles, styleSheetCreate} from '../../styles'
import type {Props} from '.'

type State = {
  initialX: number,
  initialY: number,
  finalX: number,
  finalY: number,
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
      initialX: 0,
      initialY: 0,
      finalX: 0,
      finalY: 0,
      dragging: false,
      hasPreview: false,
      scale: 1,
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
    // if (this._validDrag(e)) {
    //   e.dataTransfer.dropEffect = 'copy'
    // } else {
    //   e.dataTransfer.dropEffect = 'none'
    // }
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
      const percentage = `${(1 + parseFloat(this.state.scale)) * 100}%`
      this._image.style.maxWidth = percentage
      this._image.style.minWidth = percentage
    }
  }

  _onMouseDown = e => {
    this.setState({
      dragging: true,
      finalX: e.target.style.left ? parseInt(e.target.style.left, 10) : this.state.finalX,
      finalY: e.target.style.top ? parseInt(e.target.style.top, 10) : this.state.finalY,
      initialX: e.pageX,
      initialY: e.pageY,
    })
  }

  _onMouseUp = e => {
    this.setState({dragging: false})
  }

  _onMouseMove = e => {
    if (!this.state.dragging) return

    e.target.style.left = `${this.state.finalX + e.pageX - this.state.initialX}px`
    e.target.style.top = `${this.state.finalY + e.pageY - this.state.initialY}px`
  }

  _onSave = e => {
    const scale = 1 + parseFloat(this.state.scale)
    const x = -this._image.offsetLeft * scale
    const y = -this._image.offsetTop * scale
    const avatarSize = 256 * scale

    console.log()

    // this.props.onSave(this._image.src.replace('file://', ''), {
    //   x0: x,
    //   y0: y,
    //   x1: avatarSize + x,
    //   y1: avatarSize + y,
    // })
  }

  render = () => {
    return (
      <MaybePopup onClose={this.props.onClose} styleCover={styles.popup}>
        <Box
          style={styles.container}
          onDragOver={this._onDragOver}
          onDragLeave={this._onDragLeave}
          onDrop={this._onDrop}
        >
          <Text type="BodyBig">Drag and drop a new profile image</Text>
          <Text type="BodyPrimaryLink" onClick={this._filePickerOpen}>
            or browse your computer for one
          </Text>
          <HoverBox className={this.state.hasPreview ? 'filled' : null} onClick={this._filePickerOpen}>
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
              onMouseUp={this._onMouseUp}
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
            max={2}
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
  '&.filled': {
    backgroundColor: globalColors.white,
    borderColor: globalColors.lightGrey2,
    borderStyle: 'solid',
  },
  '&.filled:hover': {
    backgroundColor: globalColors.white,
    borderColor: globalColors.lightGrey2,
    cursor: 'grab',
  },
  ':hover': {
    backgroundColor: globalColors.blue_30,
    borderColor: globalColors.blue_60,
  },
  ':hover .icon': {
    color: globalColors.blue_60,
  },
  '&.filled img': {
    opacity: 0.25,
  },
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.lightGrey2,
  borderColor: globalColors.grey,
  borderRadius: 132,
  borderStyle: 'dashed',
  borderWidth: 4,
  cursor: 'pointer',
  height: 132,
  marginBottom: globalMargins.small,
  marginTop: globalMargins.medium,
  // overflow: 'hidden',
  position: 'relative',
  width: 132,
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
    maxWidth: '200%',
    minWidth: '200%',
    position: 'relative',
  },
  popup: {
    zIndex: EDIT_AVATAR_ZINDEX,
  },
})

export default EditAvatar
