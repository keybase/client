import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as fs from 'fs'
import flags from '../../util/feature-flags'
import clamp from 'lodash/clamp'
import {EDIT_AVATAR_ZINDEX} from '../../constants/profile'
import {Props} from '.'
import {ModalTitle} from '../../teams/common'

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

class EditAvatar extends React.Component<Props, State> {
  private file: HTMLInputElement | null = null
  private image = React.createRef()
  private timerID?: NodeJS.Timer

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
      loading: false,
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

  componentWillUnmount() {
    this.timerID && clearTimeout(this.timerID)
  }

  private filePickerFiles = () => (this.file && this.file.files) || []

  private filePickerOpen = () => {
    this.file && this.file.click()
  }

  private filePickerSetRef = (r: HTMLInputElement | null) => {
    this.file = r
  }

  private filePickerSetValue = (value: string) => {
    if (this.file) this.file.value = value
  }

  private pickFile = () => {
    this.setState({loading: true})
    const fileList = this.filePickerFiles()
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
      img && this.paintImage(img)
    }
    this.filePickerSetValue('')
  }

  private onDragLeave = () => {
    this.setState({dropping: false})
  }

  private onDrop = (e: React.DragEvent<any>) => {
    this.setState({dropping: false, loading: true})
    if (!this.validDrag(e)) {
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
      img && this.paintImage(img)
    }
  }

  private validDrag = (e: React.DragEvent<any>) => {
    return Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')
  }

  private onDragOver = (e: React.DragEvent<any>) => {
    this.setState({dropping: true})
    if (this.validDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  private paintImage = (path: string) => {
    this.setState({imageSource: path})
  }

  private onImageLoad = (e: React.SyntheticEvent<any>) => {
    // TODO: Make RPC to check file size and warn them before they try submitting.

    let height = AVATAR_SIZE
    let width = (AVATAR_SIZE * e.currentTarget.naturalWidth) / e.currentTarget.naturalHeight

    if (width < AVATAR_SIZE) {
      height = (AVATAR_SIZE * e.currentTarget.naturalHeight) / e.currentTarget.naturalWidth
      width = AVATAR_SIZE
    }

    this.setState({
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

    this.timerID = setTimeout(() => {
      this.setState({
        hasPreview: true,
        loading: false,
      })
    }, 1500)
  }

  private onRangeChange = (e: React.FormEvent<any>) => {
    const scale = parseFloat(e.currentTarget.value)
    // likely unsafe to ref this.state but afraid to change this now
    // eslint-disable-next-line
    const scaledImageHeight = this.state.startingImageHeight * scale
    // eslint-disable-next-line
    const scaledImageWidth = this.state.startingImageWidth * scale
    // eslint-disable-next-line
    const ratio = this.state.naturalImageWidth / scaledImageWidth
    const offsetLeft = clamp(
      // eslint-disable-next-line
      VIEWPORT_CENTER - this.state.viewingCenterX / ratio,
      AVATAR_SIZE - scaledImageWidth,
      0
    )
    const offsetTop = clamp(
      // eslint-disable-next-line
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

  private onMouseDown = (e: React.MouseEvent) => {
    if (!this.state.hasPreview || !this.image) return

    // Grab the values now. The event object will be nullified by the time setState is called.
    const {pageX, pageY} = e

    const img = this.image.current

    this.setState(s => ({
      dragStartX: pageX,
      dragStartY: pageY,
      // @ts-ignore codemode issue
      dragStopX: img && img.style.left ? parseInt(img.style.left, 10) : s.dragStopX,
      // @ts-ignore codemode issue
      dragStopY: img && img.style.top ? parseInt(img.style.top, 10) : s.dragStopY,
      dragging: true,
    }))
  }

  private onMouseUp = () => {
    if (!this.state.hasPreview || !this.image) return

    const img = this.image.current

    this.setState(s => ({
      // @ts-ignore codemode issue
      dragStopX: img && img.style.left ? parseInt(img.style.left, 10) : s.dragStopX,
      // @ts-ignore codemode issue
      dragStopY: img && img.style.top ? parseInt(img.style.top, 10) : s.dragStopY,
      dragging: false,
    }))
  }

  private onMouseMove = (e: React.MouseEvent) => {
    if (!this.state.dragging || this.props.submitting) return

    // Grab the values now. The event object will be nullified by the time setState is called.
    const {pageX, pageY} = e

    const offsetLeft = clamp(
      // eslint-disable-next-line
      this.state.dragStopX + pageX - this.state.dragStartX,
      // eslint-disable-next-line
      AVATAR_SIZE - this.state.scaledImageWidth,
      0
    )
    const offsetTop = clamp(
      // eslint-disable-next-line
      this.state.dragStopY + pageY - this.state.dragStartY,
      // eslint-disable-next-line
      AVATAR_SIZE - this.state.scaledImageHeight,
      0
    )
    // eslint-disable-next-line
    const ratio = this.state.naturalImageWidth / this.state.scaledImageWidth
    // eslint-disable-next-line
    const viewingCenterX = (VIEWPORT_CENTER - this.state.offsetLeft) * ratio
    // eslint-disable-next-line
    const viewingCenterY = (VIEWPORT_CENTER - this.state.offsetTop) * ratio

    this.setState({
      offsetLeft,
      offsetTop,
      viewingCenterX,
      viewingCenterY,
    })
  }

  private onSave = () => {
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
    if (flags.teamsRedesign) {
      return (
        <Kb.Modal
          onClose={this.props.onClose}
          header={{
            leftButton: this.props.wizard ? (
              <Kb.Icon type="iconfont-arrow-left" onClick={this.props.onClose} />
            ) : null,
            rightButton: this.props.wizard ? (
              <Kb.Button
                label="Skip"
                mode="Secondary"
                onClick={() => undefined}
                style={styles.skipButton}
                type="Default"
              />
            ) : null,
            title: (
              <ModalTitle
                teamname={this.props.teamname ? this.props.teamname : ''}
                title="Upload an avatar"
              />
            ),
          }}
          allowOverflow={true}
          footer={{
            content: (
              <Kb.Button
                fullWidth={true}
                label="Continue"
                onClick={this.onSave}
                disabled={!this.state.hasPreview}
              />
            ),
          }}
        >
          {!!this.props.error && (
            <Kb.Banner color="red">
              <Kb.BannerParagraph bannerColor="red" content={this.props.error} />
            </Kb.Banner>
          )}
          <Kb.Box
            className={Styles.classNames({dropping: this.state.dropping})}
            onDragLeave={this.onDragLeave}
            onDragOver={this.onDragOver}
            onDrop={this.onDrop}
            style={Styles.collapseStyles([
              styles.container,
              this.props.createdTeam && styles.paddingTopForCreatedTeam,
            ])}
            onMouseUp={this.onMouseUp}
            onMouseDown={this.onMouseDown}
            onMouseMove={this.onMouseMove}
          >
            {this.props.createdTeam && !this.props.wizard && (
              <Kb.Box style={styles.createdBanner}>
                <Kb.Text type="BodySmallSemibold" negative={true}>
                  Hoorah! Your team {this.props.teamname} was created.
                </Kb.Text>
              </Kb.Box>
            )}
            <Kb.Text center={true} type="Body" style={styles.instructions}>
              Drag and drop a {this.props.teamname ? 'team' : 'profile'} avatar or{' '}
              <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={this.filePickerOpen}>
                browse your computer for one
              </Kb.Text>
              .
            </Kb.Text>
            <HoverBox
              className={Styles.classNames({filled: this.state.hasPreview})}
              onClick={this.state.hasPreview ? null : this.filePickerOpen}
              style={{
                borderRadius: this.props.teamname ? 32 : AVATAR_CONTAINER_SIZE,
              }}
            >
              <input
                accept="image/gif,image/jpeg,image/png"
                multiple={false}
                onChange={this.pickFile}
                ref={this.filePickerSetRef}
                style={styles.hidden}
                type="file"
              />
              {this.state.loading && (
                <Kb.Box2 direction="vertical" fullHeight={true} style={styles.spinnerContainer}>
                  <Kb.ProgressIndicator type="Large" style={styles.spinner} />
                </Kb.Box2>
              )}
              <Kb.OrientedImage
                forwardedRef={this.image}
                src={this.state.imageSource}
                style={Styles.platformStyles({
                  isElectron: {
                    height: this.state.scaledImageHeight,
                    left: this.state.offsetLeft,
                    opacity: this.state.loading ? 0 : 1,
                    position: 'absolute',
                    top: this.state.offsetTop,
                    transition: 'opacity 0.25s ease-in',
                    width: this.state.scaledImageWidth,
                  },
                } as const)}
                onDragStart={e => e.preventDefault()}
                onLoad={this.onImageLoad}
              />
              {!this.state.loading && !this.state.hasPreview && (
                <Kb.Icon
                  className="icon"
                  color={Styles.globalColors.greyDark}
                  fontSize={48}
                  style={styles.icon}
                  type="iconfont-camera"
                />
              )}
            </HoverBox>
            {this.state.hasPreview && (
              <input
                disabled={!this.state.hasPreview || this.props.submitting}
                min={1}
                max={10}
                onChange={this.onRangeChange}
                onMouseMove={e => e.stopPropagation()}
                step="any"
                type="range"
                value={this.state.scale}
              />
            )}
          </Kb.Box>
        </Kb.Modal>
      )
    }

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
        onMouseMove={this.onMouseMove}
      >
        {!!this.props.error && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={this.props.error} />
          </Kb.Banner>
        )}
        <Kb.Box
          className={Styles.classNames({dropping: this.state.dropping})}
          onDragLeave={this.onDragLeave}
          onDragOver={this.onDragOver}
          onDrop={this.onDrop}
          style={Styles.collapseStyles([
            styles.container,
            {
              paddingTop: this.props.createdTeam ? 0 : Styles.globalMargins.xlarge,
            },
          ])}
          onMouseUp={this.onMouseUp}
          onMouseDown={this.onMouseDown}
          onMouseMove={this.onMouseMove}
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
            <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={this.filePickerOpen}>
              browse your computer for one
            </Kb.Text>
            .
          </Kb.Text>
          <HoverBox
            className={Styles.classNames({filled: this.state.hasPreview})}
            onClick={this.state.hasPreview ? null : this.filePickerOpen}
            style={{
              borderRadius: this.props.teamname ? 32 : AVATAR_CONTAINER_SIZE,
            }}
          >
            <input
              accept="image/gif,image/jpeg,image/png"
              multiple={false}
              onChange={this.pickFile}
              ref={this.filePickerSetRef}
              style={styles.hidden}
              type="file"
            />
            {this.state.loading && (
              <Kb.Box2 direction="vertical" fullHeight={true} style={styles.spinnerContainer}>
                <Kb.ProgressIndicator type="Large" style={styles.spinner} />
              </Kb.Box2>
            )}
            <Kb.OrientedImage
              forwardedRef={this.image}
              src={this.state.imageSource}
              style={Styles.platformStyles({
                isElectron: {
                  height: this.state.scaledImageHeight,
                  left: this.state.offsetLeft,
                  opacity: this.state.loading ? 0 : 1,
                  position: 'absolute',
                  top: this.state.offsetTop,
                  transition: 'opacity 0.25s ease-in',
                  width: this.state.scaledImageWidth,
                },
              } as const)}
              onDragStart={e => e.preventDefault()}
              onLoad={this.onImageLoad}
            />
            {!this.state.loading && !this.state.hasPreview && (
              <Kb.Icon
                className="icon"
                color={Styles.globalColors.greyDark}
                fontSize={48}
                style={styles.icon}
                type="iconfont-camera"
              />
            )}
          </HoverBox>
          {this.state.hasPreview && (
            <input
              disabled={!this.state.hasPreview || this.props.submitting}
              min={1}
              max={10}
              onChange={this.onRangeChange}
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
              onClick={this.onSave}
              waitingKey={this.props.waitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.MaybePopup>
    )
  }
}

const hoverStyles = Styles.styleSheetCreate(
  () =>
    ({
      dropping: {
        backgroundColor: Styles.globalColors.blue_60,
        borderColor: Styles.globalColors.blue_60,
      },
      droppingIcon: {color: Styles.globalColors.blue_60},
      filled: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
          borderColor: Styles.globalColors.grey,
          borderStyle: 'solid',
        },
        isElectron: {cursor: '-webkit-grab'},
      }),
      filledHover: {
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.grey,
      },
      hover: {borderColor: Styles.globalColors.black_50},
      hoverContainer: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.grey,
          borderColor: Styles.globalColors.greyDark,
          borderStyle: 'dotted',
          borderWidth: AVATAR_BORDER_SIZE,
          height: AVATAR_CONTAINER_SIZE,
          marginBottom: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.medium,
          overflow: 'hidden',
          position: 'relative',
          width: AVATAR_CONTAINER_SIZE,
        },
        isElectron: {
          cursor: 'pointer',
        },
      }),
      hoverIcon: {color: Styles.globalColors.black_50},
    } as const)
)

const HoverBox = Styles.styled(Kb.Box)(() => ({
  '&.filled': hoverStyles.filled,
  '&.filled:active': {cursor: '-webkit-grabbing'},
  '&.filled:hover': hoverStyles.filledHover,
  '&:hover': hoverStyles.hover,
  '&:hover .icon': hoverStyles.hoverIcon,
  '.dropping &': hoverStyles.dropping,
  '.dropping & .icon': hoverStyles.droppingIcon,
  ...hoverStyles.hoverContainer,
}))

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.padding(Styles.globalMargins.xlarge, 0),
    alignItems: 'center',
    height: flags.teamsRedesign ? 420 : undefined,
    minWidth: flags.teamsRedesign ? undefined : 460,
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
  paddingTopForCreatedTeam: {
    paddingTop: Styles.globalMargins.xlarge,
  },
  skipButton: {
    minWidth: 60,
  },
  spinner: {
    alignSelf: 'center',
  },
  spinnerContainer: {
    backgroundColor: Styles.globalColors.grey,
    justifyContent: 'center',
  },
}))

export default EditAvatar
