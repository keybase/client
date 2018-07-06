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
import {
  collapseStyles,
  glamorous,
  globalColors,
  globalMargins,
  globalStyles,
  styleSheetCreate,
} from '../../styles'
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
  naturalImageHeight: number,
  naturalImageWidth: number,
  offsetLeft: number,
  offsetTop: number,
  scale: number,
  scaledImageHeight: number,
  scaledImageWidth: number,
  startingImageHeight: number,
  startingImageWidth: number,
  submitting: boolean,
  viewingCenterX: number,
  viewingCenterY: number,
}

const AVATAR_CONTAINER_SIZE = 175
const AVATAR_BORDER_SIZE = 5
const AVATAR_SIZE = AVATAR_CONTAINER_SIZE - AVATAR_BORDER_SIZE * 2
const VIEWPORT_CENTER = AVATAR_SIZE / 2

class EditAvatar extends React.Component<Props, State> {
  _file: ?HTMLInputElement
  _image: ?HTMLImageElement

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
      naturalImageHeight: 0,
      naturalImageWidth: 0,
      offsetLeft: 0,
      offsetTop: 0,
      scale: 1,
      scaledImageHeight: 1,
      scaledImageWidth: 1,
      startingImageHeight: 1,
      startingImageWidth: 1,
      submitting: false,
      viewingCenterX: 0,
      viewingCenterY: 0,
    }
  }

  _imageSetRef = (ref: ?HTMLImageElement) => {
    this._image = ref
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

  _onDragLeave = () => {
    this.setState({dropping: false})
  }

  _onDrop = (e: SyntheticDragEvent<any>) => {
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

  _validDrag = (e: SyntheticDragEvent<any>) => {
    return Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')
  }

  _onDragOver = (e: SyntheticDragEvent<any>) => {
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
    // TODO: Make RPC to check file size and warn them before they try submitting.

    let height = AVATAR_SIZE
    let width = AVATAR_SIZE * e.currentTarget.naturalWidth / e.currentTarget.naturalHeight

    if (width < AVATAR_SIZE) {
      height = AVATAR_SIZE * e.currentTarget.naturalHeight / e.currentTarget.naturalWidth
      width = AVATAR_SIZE
    }

    this.setState({
      hasPreview: true,
      naturalImageHeight: e.currentTarget.naturalHeight,
      naturalImageWidth: e.currentTarget.naturalWidth,
      offsetLeft: width / -2 + VIEWPORT_CENTER,
      offsetTop: height / -2 + VIEWPORT_CENTER,
      scaledImageHeight: height,
      scaledImageWidth: width,
      startingImageHeight: height,
      startingImageWidth: width,
      viewingCenterX: e.currentTarget.naturalWidth / 2,
      viewingCenterY: e.currentTarget.naturalHeight / 2,
    })
  }

  _onRangeChange = (e: SyntheticInputEvent<any>) => {
    const scale = parseFloat(e.currentTarget.value)
    const scaledImageHeight = this.state.startingImageHeight * scale
    const scaledImageWidth = this.state.startingImageWidth * scale
    const ratio = this.state.naturalImageWidth / scaledImageWidth
    const offsetLeft = clamp(
      VIEWPORT_CENTER - this.state.viewingCenterX / ratio,
      AVATAR_SIZE - scaledImageWidth,
      0
    )
    const offsetTop = clamp(
      VIEWPORT_CENTER - this.state.viewingCenterY / ratio,
      AVATAR_SIZE - scaledImageHeight,
      0
    )

    this.setState({
      offsetLeft,
      offsetTop,
      scale,
      scaledImageHeight,
      scaledImageWidth,
    })
  }

  _onMouseDown = (e: SyntheticMouseEvent<any>) => {
    this.setState({
      dragStartX: e.pageX,
      dragStartY: e.pageY,
      dragStopX:
        this._image && this._image.style.left ? parseInt(this._image.style.left, 10) : this.state.dragStopX,
      dragStopY:
        this._image && this._image.style.top ? parseInt(this._image.style.top, 10) : this.state.dragStopY,
      dragging: true,
      offsetLeft: this._image ? this._image.offsetLeft : this.state.offsetLeft,
      offsetTop: this._image ? this._image.offsetTop : this.state.offsetTop,
    })
  }

  _onMouseUp = () => {
    this.setState({
      dragStopX:
        this._image && this._image.style.left ? parseInt(this._image.style.left, 10) : this.state.dragStopX,
      dragStopY:
        this._image && this._image.style.top ? parseInt(this._image.style.top, 10) : this.state.dragStopY,
      dragging: false,
      offsetLeft: this._image ? this._image.offsetLeft : this.state.offsetLeft,
      offsetTop: this._image ? this._image.offsetTop : this.state.offsetTop,
    })
  }

  _onMouseMove = (e: SyntheticMouseEvent<any>) => {
    if (!this.state.dragging || this.state.submitting) return

    const offsetLeft = clamp(
      this.state.dragStopX + e.pageX - this.state.dragStartX,
      AVATAR_SIZE - this.state.scaledImageWidth,
      0
    )
    const offsetTop = clamp(
      this.state.dragStopY + e.pageY - this.state.dragStartY,
      AVATAR_SIZE - this.state.scaledImageHeight,
      0
    )
    const ratio = this.state.naturalImageWidth / this.state.scaledImageWidth
    const viewingCenterX = (VIEWPORT_CENTER - this.state.offsetLeft) * ratio
    const viewingCenterY = (VIEWPORT_CENTER - this.state.offsetTop) * ratio

    this.setState({
      offsetLeft,
      offsetTop,
      viewingCenterX,
      viewingCenterY,
    })
  }

  _onSave = () => {
    this.setState({submitting: true})

    const x = this.state.offsetLeft * -1
    const y = this.state.offsetTop * -1
    const ratio =
      this.state.scaledImageWidth !== 0 ? this.state.naturalImageWidth / this.state.scaledImageWidth : 1
    const crop = {
      x0: Math.round(x * ratio),
      x1: Math.round((x + AVATAR_SIZE) * ratio),
      y0: Math.round(y * ratio),
      y1: Math.round((y + AVATAR_SIZE) * ratio),
    }
    this.props.onSave(this.state.imageSource, crop)
  }

  render() {
    return (
      <MaybePopup
        onClose={this.props.onClose}
        styleCover={collapseStyles([
          styles.cover,
          {
            cursor: this.state.dragging ? '-webkit-grabbing' : 'default',
          },
        ])}
        onMouseUp={this._onMouseUp}
        onMouseDown={this._onMouseDown}
        onMouseMove={this._onMouseMove}
      >
        <Box
          className={this.state.dropping ? 'dropping' : ''}
          onDragLeave={this._onDragLeave}
          onDragOver={this._onDragOver}
          onDrop={this._onDrop}
          style={styles.container}
        >
          <Text type="BodyBig">Drag and drop a new profile image</Text>
          <Text type="BodyPrimaryLink" className="hover-underline" onClick={this._filePickerOpen}>
            or browse your computer for one
          </Text>
          <HoverBox
            className={this.state.hasPreview ? 'filled' : ''}
            onClick={this.state.hasPreview ? null : this._filePickerOpen}
            style={styles.imageContainer}
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
              ref={this._imageSetRef}
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
            max={10}
            onChange={this._onRangeChange}
            onMouseMove={e => e.stopPropagation()}
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
    cursor: '-webkit-grab',
  },
  '&.filled:active': {
    cursor: '-webkit-grabbing',
  },
  '&.filled:hover': {
    backgroundColor: globalColors.white,
    borderColor: globalColors.lightGrey2,
  },
  '&:hover .icon, .dropping & .icon': {
    color: globalColors.black_40,
  },
  '&:hover, .dropping &': {
    borderColor: globalColors.black_40,
  },
  backgroundColor: globalColors.lightGrey2,
  borderColor: globalColors.grey,
  borderRadius: AVATAR_CONTAINER_SIZE,
  borderStyle: 'dashed',
  borderWidth: AVATAR_BORDER_SIZE,
  cursor: 'pointer',
  flex: 0,
  height: AVATAR_CONTAINER_SIZE,
  marginBottom: globalMargins.small,
  marginTop: globalMargins.medium,
  overflow: 'hidden',
  position: 'relative',
  width: AVATAR_CONTAINER_SIZE,
})

const styles = styleSheetCreate({
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    minWidth: 460,
    paddingBottom: globalMargins.xlarge,
    paddingTop: globalMargins.xlarge,
  },
  cover: {
    zIndex: EDIT_AVATAR_ZINDEX,
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
})

export default EditAvatar
