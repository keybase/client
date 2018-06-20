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
  centerX: number,
  centerY: number,
  dragging: boolean,
  dropping: boolean,
  finalX: number,
  finalY: number,
  hasPreview: boolean,
  dragLeft: string,
  imageScale: string,
  imageSource: string,
  dragTop: string,
  dragStartX: number,
  dragStartY: number,
  offsetLeft: ?number,
  offsetTop: ?number,
  originalImageHeight: number,
  originalImageWidth: number,
  scale: number,
  submitting: boolean,
}

const AVATAR_SIZE = 250
const AVATAR_BORDER_WIDTH = 0

class EditAvatar extends React.Component<Props, State> {
  _file: ?HTMLInputElement

  constructor(props: Props) {
    super(props)
    this.state = {
      centerX: 0,
      centerY: 0,
      dragging: false,
      dropping: false,
      finalX: 0,
      finalY: 0,
      hasPreview: false,
      dragLeft: '0px',
      imageScale: '100%',
      imageSource: '',
      dragTop: '0px',
      dragStartX: 0,
      dragStartY: 0,
      originalImageHeight: 0,
      originalImageWidth: 0,
      offsetLeft: null,
      offsetTop: null,
      scale: 0,
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
    this.setState({
      hasPreview: true,
      originalImageHeight: e.currentTarget.naturalHeight,
      originalImageWidth: e.currentTarget.naturalWidth,
      offsetLeft: e.currentTarget.offsetLeft * -2,
      offsetTop: e.currentTarget.offsetTop * -2,
    })
  }

  _onRangeChange = e => {
    this.setState({
      imageScale: `${parseFloat(e.currentTarget.value) * 100}%`,
      scale: e.currentTarget.value,
    })
  }

  _onMouseDown = e => {
    console.log('down', e.pageX, e.pageY, e.currentTarget)

    this.setState({
      dragging: true,
      finalX: e.currentTarget.style.left ? parseInt(e.currentTarget.style.left, 10) : this.state.finalX,
      finalY: e.currentTarget.style.top ? parseInt(e.currentTarget.style.top, 10) : this.state.finalY,
      dragStartX: e.pageX,
      dragStartY: e.pageY,
      centerX: this.state.originalImageWidth / 2 + e.currentTarget.offsetLeft - AVATAR_SIZE / 2,
      centerY: this.state.originalImageHeight / 2 + e.currentTarget.offsetTop - AVATAR_SIZE / 2,
      offsetLeft: e.currentTarget.offsetLeft,
      offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onMouseUp = e => {
    this.setState({
      dragging: false,
      finalX: e.currentTarget.style.left ? parseInt(e.currentTarget.style.left, 10) : this.state.finalX,
      finalY: e.currentTarget.style.top ? parseInt(e.currentTarget.style.top, 10) : this.state.finalY,
      centerX: this.state.originalImageWidth / 2 + e.currentTarget.offsetLeft - AVATAR_SIZE / 2,
      centerY: this.state.originalImageHeight / 2 + e.currentTarget.offsetTop - AVATAR_SIZE / 2,
      offsetLeft: e.currentTarget.offsetLeft,
      offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onMouseMove = e => {
    if (!this.state.dragging || this.state.submitting) return

    this.setState({
      dragLeft: `${this.state.finalX + e.pageX - this.state.dragStartX}px`,
      dragTop: `${this.state.finalY + e.pageY - this.state.dragStartY}px`,
      centerX: this.state.originalImageWidth / 2 + e.currentTarget.offsetLeft - AVATAR_SIZE / 2,
      centerY: this.state.originalImageHeight / 2 + e.currentTarget.offsetTop - AVATAR_SIZE / 2,
      offsetLeft: e.currentTarget.offsetLeft,
      offsetTop: e.currentTarget.offsetTop,
    })
  }

  _onSave = e => {
    this.setState({submitting: true})

    const x = this.state.offsetLeft * -1
    const y = this.state.offsetTop * -1
    const crop = {
      x0: x,
      y0: y,
      x1: x + AVATAR_SIZE,
      y1: y + AVATAR_SIZE,
    }
    console.log(crop)

    // this.props.onSave(this.state.imageSource, crop)
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
          <Text type="BodyBig">
            x: {this.state.centerX} y: {this.state.centerY}
          </Text>
          <HoverBox
            className={this._hoverBoxClassName}
            onClick={this.state.hasPreview ? null : this._filePickerOpen}
          >
            <input
              multiple={false}
              onChange={this._pickFile}
              ref={this._filePickerSetRef}
              style={styles.hidden}
              type="file"
            />
            <img
              src={this.state.imageSource}
              style={{
                alignSelf: 'center',
                height: this.state.originalImageHeight,
                left: this.state.dragLeft,
                // maxHeight: this.state.imageScale,
                // maxWidth: this.state.imageScale,
                position: 'relative',
                top: this.state.dragTop,
                width: this.state.originalImageWidth,
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
            min={-5}
            max={5}
            onChange={this._onRangeChange}
            step={0.001}
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
            <Button
              disabled={!this.state.hasPreview}
              label="Save"
              onClick={this._onSave}
              type="Primary"
              // waitingKey={null}
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
    borderColor: globalColors.red, // lightGrey2,
    borderStyle: 'solid',
  },
  '&.filled:active': {
    cursor: 'grabbing',
  },
  '&.filled:hover': {
    backgroundColor: globalColors.white,
    borderColor: globalColors.red, // lightGrey2,
    cursor: 'grab',
  },
  ':hover, &.dropping': {
    borderColor: globalColors.black_40,
  },
  ':hover .icon, &.dropping .icon': {
    color: globalColors.black_40,
  },
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.lightGrey2,
  borderColor: globalColors.red, // grey,
  // borderRadius: AVATAR_SIZE,
  borderStyle: 'dashed',
  borderWidth: AVATAR_BORDER_WIDTH,
  cursor: 'pointer',
  height: AVATAR_SIZE,
  justifyContent: 'center',
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
