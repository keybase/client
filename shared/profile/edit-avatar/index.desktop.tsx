import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as fs from 'fs'
import {clamp} from 'lodash-es'
import HOCTimers, {PropsWithTimer} from '../../common-adapters/hoc-timers'
import {EDIT_AVATAR_ZINDEX} from '../../constants/profile'
import {Props} from '.'

type _Props = PropsWithTimer<Props>

type State = {
  dragStartX: number
  dragStartY: number
  dragStopX: number
  dragStopY: number
  dragging: boolean
  dropping: boolean
  hasPreview: boolean
  imageSource: string
  loading: boolean
  naturalImageHeight: number
  naturalImageWidth: number
  offsetLeft: number
  offsetTop: number
  scale: number
  scaledImageHeight: number
  scaledImageWidth: number
  startingImageHeight: number
  startingImageWidth: number
  viewingCenterX: number
  viewingCenterY: number
}

const AVATAR_CONTAINER_SIZE = 175
const AVATAR_BORDER_SIZE = 4
const AVATAR_SIZE = AVATAR_CONTAINER_SIZE - AVATAR_BORDER_SIZE * 2
const VIEWPORT_CENTER = AVATAR_SIZE / 2

class EditAvatar extends React.Component<_Props, State> {
  _file: HTMLInputElement | null = null
  _image = React.createRef()
  constructor(props: _Props) {
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
      loading: false,
      naturalImageHeight: 0,
      naturalImageWidth: 0,
      offsetLeft: 0,
      offsetTop: 0,
      scale: 1,
      scaledImageHeight: 1,
      scaledImageWidth: 1,
      startingImageHeight: 1,
      startingImageWidth: 1,
      viewingCenterX: 0,
      viewingCenterY: 0,
    }
  }

  _filePickerFiles = () => (this._file && this._file.files) || []

  _filePickerOpen = () => {
    this._file && this._file.click()
  }

  _filePickerSetRef = (r: HTMLInputElement | null) => {
    this._file = r
  }

  _filePickerSetValue = (value: string) => {
    if (this._file) this._file.value = value
  }

  _pickFile = () => {
    this.setState({loading: true})
    const fileList = this._filePickerFiles()
    const paths: Array<string> = fileList.length
      ? Array.prototype.map
          .call(fileList, (f: File) => {
            // We rely on path being here, even though it's not part of the File spec.
            const path: string = f.path
            return path
          })
          .filter(Boolean)
      : ([] as any)
    if (paths) {
      const img = paths.pop()
      img && this._paintImage(img)
    }
    this._filePickerSetValue('')
  }

  _onDragLeave = () => {
    this.setState({dropping: false})
  }

  _onDrop = (e: React.DragEvent<any>) => {
    this.setState({dropping: false, loading: true})
    if (!this._validDrag(e)) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths: Array<string> = fileList.length
      ? Array.prototype.map.call(fileList, f => f.path)
      : ([] as any)
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
      const img = paths.pop()
      img && this._paintImage(img)
    }
  }

  _validDrag = (e: React.DragEvent<any>) => {
    return Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')
  }

  _onDragOver = (e: React.DragEvent<any>) => {
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

  _onImageLoad = (e: React.SyntheticEvent<any>) => {
    // TODO: Make RPC to check file size and warn them before they try submitting.

    let height = AVATAR_SIZE
    let width = (AVATAR_SIZE * e.currentTarget.naturalWidth) / e.currentTarget.naturalHeight

    if (width < AVATAR_SIZE) {
      height = (AVATAR_SIZE * e.currentTarget.naturalHeight) / e.currentTarget.naturalWidth
      width = AVATAR_SIZE
    }

    this.setState({
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

    this.props.setTimeout(() => {
      this.setState({
        hasPreview: true,
        loading: false,
      })
    }, 1500)
  }

  _onRangeChange = (e: React.FormEvent<any>) => {
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

  _onMouseDown = (e: React.MouseEvent) => {
    if (!this.state.hasPreview || !this._image) return

    const img = this._image.current

    this.setState({
      dragStartX: e.pageX,
      dragStartY: e.pageY,
      // @ts-ignore codemode issue
      dragStopX: img && img.style.left ? parseInt(img.style.left, 10) : this.state.dragStopX,
      // @ts-ignore codemode issue
      dragStopY: img && img.style.top ? parseInt(img.style.top, 10) : this.state.dragStopY,
      dragging: true,
    })
  }

  _onMouseUp = () => {
    if (!this.state.hasPreview || !this._image) return

    const img = this._image.current

    this.setState({
      // @ts-ignore codemode issue
      dragStopX: img && img.style.left ? parseInt(img.style.left, 10) : this.state.dragStopX,
      // @ts-ignore codemode issue
      dragStopY: img && img.style.top ? parseInt(img.style.top, 10) : this.state.dragStopY,
      dragging: false,
    })
  }

  _onMouseMove = (e: React.MouseEvent) => {
    if (!this.state.dragging || this.props.submitting) return

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
      <Kb.MaybePopup
        onClose={this.props.onClose}
        styleClipContainer={styles.overflowHidden}
        styleCover={Styles.collapseStyles([
          styles.cover,
          {
            cursor: this.state.dragging ? '-webkit-grabbing' : 'default',
          },
        ])}
        onMouseUp={this._onMouseUp}
        onMouseDown={this._onMouseDown}
        onMouseMove={this._onMouseMove}
      >
        {!!this.props.error && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={this.props.error} />
          </Kb.Banner>
        )}
        <Kb.Box
          className={Styles.classNames({dropping: this.state.dropping})}
          onDragLeave={this._onDragLeave}
          onDragOver={this._onDragOver}
          onDrop={this._onDrop}
          style={Styles.collapseStyles([
            styles.container,
            {
              paddingTop: this.props.createdTeam ? 0 : Styles.globalMargins.xlarge,
            },
          ])}
        >
          {this.props.createdTeam && (
            <Kb.Box style={styles.createdBanner}>
              <Kb.Text type="BodySmallSemibold" negative={true}>
                Hoorah! Your team {this.props.teamname} was created.
              </Kb.Text>
            </Kb.Box>
          )}
          <Kb.Text center={true} type="Body" style={styles.instructions}>
            Drag and drop a {this.props.teamname ? 'team' : 'profile'} avatar or{' '}
            <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={this._filePickerOpen}>
              browse your computer for one
            </Kb.Text>
            .
          </Kb.Text>
          <HoverBox
            className={Styles.classNames({filled: this.state.hasPreview})}
            onClick={this.state.hasPreview ? null : this._filePickerOpen}
            style={{
              borderRadius: this.props.teamname ? 32 : AVATAR_CONTAINER_SIZE,
            }}
          >
            <input
              accept="image/*"
              multiple={false}
              onChange={this._pickFile}
              ref={this._filePickerSetRef}
              style={styles.hidden}
              type="file"
            />
            {this.state.loading && (
              <Kb.Box2 direction="vertical" fullHeight={true} style={styles.spinnerContainer}>
                <Kb.ProgressIndicator type="Large" style={Kb.iconCastPlatformStyles(styles.spinner)} />
              </Kb.Box2>
            )}
            <Kb.OrientedImage
              forwardedRef={this._image}
              src={this.state.imageSource}
              style={{
                height: this.state.scaledImageHeight,
                left: this.state.offsetLeft,
                opacity: this.state.loading ? '0' : '1',
                position: 'absolute',
                top: this.state.offsetTop,
                transition: 'opacity 0.25s ease-in',
                width: this.state.scaledImageWidth,
              }}
              onDragStart={e => e.preventDefault()}
              onLoad={this._onImageLoad}
            />
            {!this.state.loading && !this.state.hasPreview && (
              <Kb.Icon
                className="icon"
                color={Styles.globalColors.greyDark}
                fontSize={48}
                style={Kb.iconCastPlatformStyles(styles.icon)}
                type="iconfont-camera"
              />
            )}
          </HoverBox>
          {this.state.hasPreview && (
            <input
              disabled={!this.state.hasPreview || this.props.submitting}
              min={1}
              max={10}
              onChange={this._onRangeChange}
              onMouseMove={e => e.stopPropagation()}
              step="any"
              type="range"
              value={this.state.scale}
            />
          )}
          <Kb.ButtonBar>
            <Kb.WaitingButton
              label={this.props.createdTeam ? 'Later, thanks' : 'Cancel'}
              onClick={this.props.onClose}
              type="Dim"
              waitingKey={this.props.waitingKey}
              onlyDisable={true}
            />
            <Kb.WaitingButton
              disabled={!this.state.hasPreview}
              label="Save"
              onClick={this._onSave}
              waitingKey={this.props.waitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.MaybePopup>
    )
  }
}

const HoverBox = Styles.styled(Kb.Box)({
  '&.filled': {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderStyle: 'solid',
    cursor: '-webkit-grab',
  },
  '&.filled:active': {cursor: '-webkit-grabbing'},
  '&.filled:hover': {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
  },
  '&:hover': {borderColor: Styles.globalColors.black_50},
  '&:hover .icon': {color: Styles.globalColors.black_50},
  '.dropping &': {
    backgroundColor: Styles.globalColors.blue_60,
    borderColor: Styles.globalColors.blue_60,
  },
  '.dropping & .icon': {color: Styles.globalColors.blue_60},
  backgroundColor: Styles.globalColors.grey,
  borderColor: Styles.globalColors.greyDark,
  borderStyle: 'dotted',
  borderWidth: AVATAR_BORDER_SIZE,
  cursor: 'pointer',
  height: AVATAR_CONTAINER_SIZE,
  marginBottom: Styles.globalMargins.small,
  marginTop: Styles.globalMargins.medium,
  overflow: 'hidden',
  position: 'relative',
  width: AVATAR_CONTAINER_SIZE,
})

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    minWidth: 460,
    paddingBottom: Styles.globalMargins.xlarge,
  },
  cover: {zIndex: EDIT_AVATAR_ZINDEX},
  createdBanner: {
    backgroundColor: Styles.globalColors.green,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: Styles.globalMargins.large,
    paddingBottom: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.xsmall,
    textAlign: 'center',
    width: '100%',
  },
  hidden: {display: 'none'},
  icon: {
    left: '50%',
    marginLeft: -24,
    marginTop: -21,
    position: 'absolute',
    top: '50%',
  },
  instructions: {
    maxWidth: 200,
  },
  overflowHidden: {overflow: 'hidden'},
  spinner: {
    alignSelf: 'center',
  },
  spinnerContainer: {
    backgroundColor: Styles.globalColors.grey,
    justifyContent: 'center',
  },
})

export default HOCTimers(EditAvatar)
