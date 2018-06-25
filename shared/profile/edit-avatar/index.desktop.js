// @flow
import * as React from 'react'
import fs from 'fs'
import {clamp} from 'lodash-es'
import {
  Box,
  Button,
  ButtonBar,
  Icon,
  MaybePopup,
  Text,
  WaitingButton,
  iconCastPlatformStyles,
} from '../../common-adapters'
import {EDIT_AVATAR_ZINDEX} from '../../constants/profile'
import {glamorous, globalColors, globalMargins, globalStyles, styleSheetCreate} from '../../styles'
import type {Props} from '.'

type State = {
  dragStartX: number,
  dragStartY: number,
  dragStopX: number,
  dragStopY: number,
  dragging: boolean,
  dropping: boolean,
  hasPreview: boolean,
  imageSource: string,
  offsetLeft: number,
  offsetTop: number,
  originalImageHeight: number,
  originalImageWidth: number,
  scale: number,
  scaledImageHeight: number,
  scaledImageWidth: number,
  submitting: boolean,
}

const AVATAR_SIZE = 175
const AVATAR_BORDER_WIDTH = 5

class EditAvatar extends React.Component<Props, State> {
  _file: ?HTMLInputElement

  constructor(props: Props) {
    super(props)
    this.state = {
      dragStartX: 0,
      dragStartY: 0,
      dragStopX: 0,
      dragStopY: 0,
      dragging: false,
      dropping: false,
      hasPreview: false,
      imageSource: '',
      offsetLeft: 0,
      offsetTop: 0,
      originalImageHeight: 0,
      originalImageWidth: 0,
      scale: 1,
      scaledImageHeight: 0,
      scaledImageWidth: 0,
      submitting: false,
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

  _onDragLeave = e => {
    this.setState({dropping: false})
  }

  _onDrop = e => {
    e.persist()
    this.setState({dropping: false})
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
        }
      }
      this._paintImage(paths.pop())
    }
  }

  _validDrag = e => Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')

  _onDragOver = e => {
    this.setState({dropping: true})
    if (this._validDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  _paintImage = (path: string) => {
    this.setState({imageSource: path})
  }

  _onImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    this.setState({
      hasPreview: true,
      offsetLeft: Math.round(e.currentTarget.naturalWidth / -2 + AVATAR_SIZE / 2 - AVATAR_BORDER_WIDTH),
      offsetTop: Math.round(e.currentTarget.naturalHeight / -2 + AVATAR_SIZE / 2 - AVATAR_BORDER_WIDTH),
      originalImageHeight: e.currentTarget.naturalHeight,
      originalImageWidth: e.currentTarget.naturalWidth,
      scaledImageHeight: e.currentTarget.naturalHeight,
      scaledImageWidth: e.currentTarget.naturalWidth,
    })
  }

  _onRangeChange = e => {
    const scale = e.currentTarget.value
    const scaledImageHeight = Math.round(this.state.originalImageHeight * scale)
    const scaledImageWidth = Math.round(this.state.originalImageWidth * scale)

    this.setState({
      scale,
      scaledImageHeight,
      scaledImageWidth,
    })
  }

  _onMouseDown = (e: SyntheticMouseEvent<HTMLImageElement>) => {
    this.setState({
      dragStartX: e.pageX,
      dragStartY: e.pageY,
      dragStopX: e.currentTarget.style.left ? parseInt(e.currentTarget.style.left, 10) : this.state.dragStopX,
      dragStopY: e.currentTarget.style.top ? parseInt(e.currentTarget.style.top, 10) : this.state.dragStopY,
      dragging: true,
      offsetLeft: e.currentTarget.offsetLeft,
      offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onMouseUp = (e: SyntheticMouseEvent<HTMLImageElement>) => {
    this.setState({
      dragStopX: e.currentTarget.style.left ? parseInt(e.currentTarget.style.left, 10) : this.state.dragStopX,
      dragStopY: e.currentTarget.style.top ? parseInt(e.currentTarget.style.top, 10) : this.state.dragStopY,
      dragging: false,
      offsetLeft: e.currentTarget.offsetLeft,
      offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onMouseMove = (e: SyntheticMouseEvent<HTMLImageElement>) => {
    if (!this.state.dragging || this.state.submitting) return

    const dragLeft = this.state.dragStopX + e.pageX - this.state.dragStartX
    const dragTop = this.state.dragStopY + e.pageY - this.state.dragStartY
    const dragLeftLimit = AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2 - this.state.scaledImageWidth
    const dragTopLimit = AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2 - this.state.scaledImageHeight

    this.setState({
      offsetLeft: clamp(dragLeft, dragLeftLimit, 0),
      offsetTop: clamp(dragTop, dragTopLimit, 0),
    })
  }

  _onSave = e => {
    this.setState({submitting: true})

    const x = this.state.offsetLeft * -1
    const y = this.state.offsetTop * -1
    const rH = this.state.originalImageHeight / this.state.scaledImageHeight
    const rW = this.state.originalImageWidth / this.state.scaledImageWidth
    const crop = {
      x0: Math.round(x * rW),
      x1: Math.round((x + AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2) * rW),
      y0: Math.round(y * rH),
      y1: Math.round((y + AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2) * rH),
    }
    this.props.onSave(this.state.imageSource, crop)
  }

  _hoverBoxClassName = () => {
    if (this.state.hasPreview) return 'filled'
    if (this.state.dropping) return 'dropping'
  }

  render = () => {
    return (
      <MaybePopup onClose={this.props.onClose} styleCover={styles.popup}>
        <Box
          onDragLeave={this._onDragLeave}
          onDragOver={this._onDragOver}
          onDrop={this._onDrop}
          style={styles.container}
        >
          <Text type="BodyBig">Drag and drop a new profile image</Text>
          <Text type="BodyPrimaryLink" onClick={this._filePickerOpen}>
            or browse your computer for one
          </Text>
          <HoverBox
            className={this._hoverBoxClassName}
            onClick={this.state.hasPreview ? null : this._filePickerOpen}
          >
            <input
              accept="image/*"
              multiple={false}
              onChange={this._pickFile}
              ref={this._filePickerSetRef}
              style={styles.hidden}
              type="file"
            />
            <img
              src={this.state.imageSource}
              style={{
                height: this.state.scaledImageHeight,
                left: `${this.state.offsetLeft}px`,
                position: 'absolute',
                top: `${this.state.offsetTop}px`,
                width: this.state.scaledImageWidth,
              }}
              onDragStart={e => e.preventDefault()}
              onLoad={this._onImageLoad}
              onMouseUp={this._onMouseUp}
              onMouseDown={this._onMouseDown}
              onMouseMove={this._onMouseMove}
            />
            {!this.state.hasPreview && (
              <Icon
                className="icon"
                color={globalColors.grey}
                fontSize={48}
                style={iconCastPlatformStyles(styles.icon)}
                type="iconfont-camera"
              />
            )}
          </HoverBox>
          <input
            disabled={!this.state.hasPreview || this.state.submitting}
            min={1}
            max={5}
            onChange={this._onRangeChange}
            step="any"
            style={styles.slider}
            type="range"
            value={this.state.scale}
          />
          <ButtonBar>
            <Button
              disabled={this.state.submitting}
              label="Cancel"
              onClick={this.props.onClose}
              type="Secondary"
            />
            <WaitingButton
              disabled={!this.state.hasPreview}
              label="Save"
              onClick={this._onSave}
              type="Primary"
              waitingKey={null}
            />
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
  '&.filled:active': {
    cursor: 'grabbing',
  },
  '&.filled:hover': {
    backgroundColor: globalColors.white,
    borderColor: globalColors.lightGrey2,
    cursor: 'grab',
  },
  ':hover, &.dropping': {
    borderColor: globalColors.black_40,
  },
  ':hover .icon, &.dropping .icon': {
    color: globalColors.black_40,
  },
  backgroundColor: globalColors.lightGrey2,
  borderColor: globalColors.grey,
  borderRadius: AVATAR_SIZE,
  borderStyle: 'dashed',
  borderWidth: AVATAR_BORDER_WIDTH,
  cursor: 'pointer',
  flex: 0,
  height: AVATAR_SIZE,
  marginBottom: globalMargins.small,
  marginTop: globalMargins.medium,
  overflow: 'hidden',
  position: 'relative',
  width: AVATAR_SIZE,
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
  popup: {
    zIndex: EDIT_AVATAR_ZINDEX,
  },
})

export default EditAvatar
