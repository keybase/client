// @flow
import * as React from 'react'
import fs from 'fs'
import logger from '../../logger'
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
  // centerX: number,
  // centerY: number,
  dragging: boolean,
  dropping: boolean,
  dragStopX: number,
  dragStopY: number,
  hasPreview: boolean,
  dragLeft: string,
  imageSource: string,
  dragTop: string,
  dragStartX: number,
  dragStartY: number,
  // offsetLeft: ?number,
  // offsetTop: ?number,
  originalImageHeight: number,
  originalImageWidth: number,
  scale: number,
  scaledImageHeight: number,
  scaledImageWidth: number,
  submitting: boolean,
}

const AVATAR_SIZE = 250
const AVATAR_BORDER_WIDTH = 0

class EditAvatar extends React.Component<Props, State> {
  _file: ?HTMLInputElement

  constructor(props: Props) {
    super(props)
    this.state = {
      // centerX: 0,
      // centerY: 0,
      dragging: false,
      dropping: false,
      dragStopX: 0,
      dragStopY: 0,
      hasPreview: false,
      dragLeft: '0px',
      imageSource: '',
      dragTop: '0px',
      dragStartX: 0,
      dragStartY: 0,
      originalImageHeight: 0,
      originalImageWidth: 0,
      // offsetLeft: null,
      // offsetTop: null,
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
          logger.warn(`Error stating dropped avatar: ${e.code}`)
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
    console.log('loaded', e.currentTarget.naturalWidth, e.currentTarget.offsetLeft)

    this.setState({
      hasPreview: true,
      // offsetLeft: e.currentTarget.offsetLeft,
      // offsetTop: e.currentTarget.offsetTop,
      dragLeft: `${e.currentTarget.naturalWidth / -2 + AVATAR_SIZE / 2}px`,
      dragTop: `${e.currentTarget.naturalHeight / -2 + AVATAR_SIZE / 2}px`,
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
    const dragLeft = parseInt(this.state.dragLeft, 10)
    const dragTop = parseInt(this.state.dragTop, 10)
    const mLeft = dragLeft < 0 ? -1 : 1
    const mTop = dragTop < 0 ? -1 : 1

    this.setState({
      dragLeft: `${mLeft * Math.round(scaledImageWidth / 2 - AVATAR_SIZE / 2)}px`,
      dragTop: `${mTop * Math.round(scaledImageHeight / 2 - AVATAR_SIZE / 2)}px`,
      scale,
      scaledImageHeight,
      scaledImageWidth,
    })

    console.log('scaled', this.state.scaledImageHeight, this.state.scaledImageWidth)
  }

  _onMouseDown = e => {
    console.log('down', e.currentTarget.naturalWidth, e.currentTarget.offsetLeft)

    this.setState({
      dragStartX: e.pageX,
      dragStartY: e.pageY,
      dragging: true,
      dragStopX: e.currentTarget.style.left ? parseInt(e.currentTarget.style.left, 10) : this.state.dragStopX,
      dragStopY: e.currentTarget.style.top ? parseInt(e.currentTarget.style.top, 10) : this.state.dragStopY,
      // offsetLeft: e.currentTarget.offsetLeft,
      // offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onMouseUp = e => {
    console.log('up', e.currentTarget.naturalWidth, e.currentTarget.offsetLeft)

    this.setState({
      dragging: false,
      dragStopX: e.currentTarget.style.left ? parseInt(e.currentTarget.style.left, 10) : this.state.dragStopX,
      dragStopY: e.currentTarget.style.top ? parseInt(e.currentTarget.style.top, 10) : this.state.dragStopY,
      // offsetLeft: e.currentTarget.offsetLeft,
      // offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onMouseMove = e => {
    if (!this.state.dragging || this.state.submitting) return

    this.setState({
      dragLeft: `${this.state.dragStopX + e.pageX - this.state.dragStartX}px`,
      dragTop: `${this.state.dragStopY + e.pageY - this.state.dragStartY}px`,
      // offsetLeft: e.currentTarget.offsetLeft,
      // offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onSave = e => {
    this.setState({submitting: true})

    // if (this.state.offsetLeft && this.state.offsetTop) {
    //   const x = this.state.offsetLeft * -1
    //   const y = this.state.offsetTop * -1
    //   const rH = this.state.originalImageHeight / this.state.scaledImageHeight
    //   const rW = this.state.originalImageWidth / this.state.scaledImageWidth
    //   const crop = {
    //     x0: Math.round(x * rW),
    //     y0: Math.round(y * rH),
    //     x1: Math.round((x + AVATAR_SIZE) * rW),
    //     y1: Math.round((y + AVATAR_SIZE) * rH),
    //   }
    //   console.log(crop)
    //   this.props.onSave(this.state.imageSource, crop)
    //   return
    // }

    // this.props.onSave(this.state.imageSource)
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
          <Text type="BodyBig">w: {this.state.scaledImageWidth}</Text>
          <Text type="BodyBig">h: {this.state.scaledImageHeight}</Text>
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
                left: this.state.dragLeft,
                position: 'absolute',
                top: this.state.dragTop,
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
  // borderRadius: AVATAR_SIZE,
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
