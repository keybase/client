import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import clamp from 'lodash/clamp'
import type {Props} from '.'
import {ModalTitle} from '../../teams/common'
import {AVATAR_SIZE} from '../../common-adapters/avatar'
import KB2 from '../../util/electron.desktop'
import './edit-avatar.css'

const AVATAR_CONTAINER_SIZE = 167 // 300
const AVATAR_BORDER_SIZE = 4
const VIEWPORT_CENTER = AVATAR_CONTAINER_SIZE / 2

const {isDirectory} = KB2.functions

// TODO use zoomableimage here instead

type State = {
  dragStartX: number
  dragStartY: number
  dragStopX: number
  dragStopY: number
  dragging: boolean
  dropping: boolean
  error: boolean
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

const validDrag = (e: React.DragEvent<any>) => {
  return Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')
}

const getFile = async (fileList: {length?: number}): Promise<string> => {
  const paths: Array<string> = fileList?.length
    ? Array.prototype.map.call(fileList, f => f.path)
    : ([] as any)
  if (!paths.length) {
    return ''
  }
  for (const path of paths) {
    try {
      const isDir = await (isDirectory?.(path) ?? Promise.resolve(false))
      if (isDir) {
        return ''
      }
    } catch (e) {}
  }
  return paths.pop() ?? ''
}

type Crop = {
  height: number
  width: number
  x: number
  y: number
  scale: number
}
const getCropCoordinates = (c: Crop) => {
  const {x, y, scale, width, height} = c
  const maxX = width / scale
  const maxY = height / scale
  const windowScaled = Math.round(AVATAR_CONTAINER_SIZE / scale)
  let x0 = x / scale
  x0 = clamp(Math.round(x0), 0, maxX)
  // const x1 = clamp(Math.round(x0 + AVATAR_CONTAINER_SIZE / scale), x0, maxX)
  const x1 = Math.min(x0 + windowScaled, maxX)
  let y0 = y / scale
  y0 = clamp(Math.round(y0), 0, maxY)
  // const y1 = clamp(Math.round(y0 + AVATAR_CONTAINER_SIZE / scale), y0, maxY)
  const y1 = Math.min(y0 + windowScaled, maxY)
  return {x0, x1, y0, y1}

  // x0pixels should be: 2400 (pixels) - 300 (zoomed pixels) = 2100
  // x1pixels should be: 2100 (x0pixels) + 300 (zoomed pixels) = 2400

  // x0: 2100 / 2(zoom) = 1050 (good)
  // x1: 2400 / 2 (zoom) = 1200 (good)

  // x1 - x0: 150 should be
}

type Loading = undefined | 'loading' | 'loaded'
const EditAvatar = (p: Props) => {
  const {onClose, wizard, showBack, onBack, onSkip, type, error, teamID, createdTeam, teamname} = p
  const [serror, setSerror] = React.useState(false)
  const [dropping, setDropping] = React.useState(false)
  const [loading, setLoading] = React.useState<Loading>()
  const [imageSource, setImageSource] = React.useState('')

  const fileRef = React.useRef<HTMLInputElement>(null)

  const onSave = () => {
    const crop = getCropCoordinates(cropRef.current)
    console.log('aaaa onsave', crop, cropRef.current)
    p.onSave(imageSource, crop)
  }
  const cropRef = React.useRef({height: 0, unscaledHeight: 0, unscaledWidth: 0, width: 0, x: 0, y: 0})
  const onChanged = (e: Crop) => {
    console.log('aaa onchanged', e)
    cropRef.current = e
  }

  const onImageLoad = () => {
    setLoading('loaded')
  }
  const onDrop = async (e: React.DragEvent<any>) => {
    setDropping(false)
    setSerror(false)
    setLoading('loading')
    if (!validDrag(e)) {
      return
    }
    const img = await getFile(e.dataTransfer.files)
    if (img) {
      setImageSource(img)
    }
  }
  const filePickerOpen = () => {
    fileRef.current?.click()
  }
  const pickFile = async () => {
    setSerror(false)
    setLoading('loading')
    const img = await getFile(fileRef.current?.files)
    if (img) {
      setImageSource(img)
    }
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{
        leftButton: wizard || showBack ? <Kb.Icon type="iconfont-arrow-left" onClick={onBack} /> : null,
        rightButton: wizard ? (
          <Kb.Button
            label="Skip"
            mode="Secondary"
            onClick={onSkip}
            style={styles.skipButton}
            type="Default"
          />
        ) : null,
        title: type === 'team' ? <ModalTitle teamID={teamID} title="Upload an avatar" /> : 'Upload an avatar',
      }}
      allowOverflow={true}
      footer={{
        content: (
          <Kb.WaitingButton
            fullWidth={true}
            label={wizard ? 'Continue' : 'Save'}
            onClick={onSave}
            disabled={loading !== 'loaded'}
            waitingKey={null}
          />
        ),
      }}
      banners={
        <>
          {error ? (
            <Kb.Banner color="red" key="propsError">
              {error}
            </Kb.Banner>
          ) : null}
          {serror ? (
            <Kb.Banner color="red" key="stateError">
              The image you uploaded could not be read. Try again with a valid PNG, JPG or GIF.
            </Kb.Banner>
          ) : null}
        </>
      }
    >
      <Kb.Box
        className={Styles.classNames({dropping: dropping})}
        onDrop={onDrop}
        style={Styles.collapseStyles([styles.container, createdTeam && styles.paddingTopForCreatedTeam])}
      >
        {type === 'team' && createdTeam && !wizard && (
          <Kb.Box style={styles.createdBanner}>
            <Kb.Text type="BodySmallSemibold" negative={true}>
              Hoorah! Your team {teamname} was created.
            </Kb.Text>
          </Kb.Box>
        )}
        <Kb.Text center={true} type="Body" style={styles.instructions}>
          Drag and drop a {type} avatar or{' '}
          <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={filePickerOpen}>
            browse your computer
          </Kb.Text>{' '}
          for one.
        </Kb.Text>
        <Kb.Box
          className={Styles.classNames('hoverbox', {filled: loading !== 'loaded'})}
          onClick={!loading ? filePickerOpen : undefined}
          style={{
            borderRadius: type === 'team' ? 32 : AVATAR_CONTAINER_SIZE,
            ...hoverStyles.hoverContainer,
          }}
        >
          <input
            accept="image/gif,image/jpeg,image/png"
            multiple={false}
            onChange={pickFile}
            ref={fileRef}
            style={styles.hidden}
            type="file"
          />
          <Kb.ZoomableImage dragPan={true} src={imageSource} onChanged={onChanged} onLoaded={onImageLoad} />
          {!loading && (
            <Kb.Icon
              className="icon"
              color={Styles.globalColors.greyDark}
              fontSize={48}
              style={styles.icon}
              type="iconfont-camera"
            />
          )}
        </Kb.Box>
        {loading === 'loaded' ? <Kb.Text type="Body">Click to select. Scroll to zoom.</Kb.Text> : null}
      </Kb.Box>
    </Kb.Modal>
  )
}

// class EditAvatar2 extends React.Component<Props, State> {
//   private file: HTMLInputElement | null = null
//   private imageRef = React.createRef<Kb.Image2>()
//   private timerID?: ReturnType<typeof setTimeout>

//   constructor(props: Props) {
//     super(props)
//     this.state = {
//       dragStartX: 0,
//       dragStartY: 0,
//       dragStopX: 0,
//       dragStopY: 0,
//       dragging: false,
//       dropping: false,
//       error: false,
//       hasPreview: false,
//       imageSource: '',
//       loading: false,
//       naturalImageWidth: 0,
//       offsetLeft: 0,
//       offsetTop: 0,
//       scale: 1,
//       scaledImageHeight: 1,
//       scaledImageWidth: 1,
//       startingImageHeight: 1,
//       startingImageWidth: 1,
//       viewingCenterX: 0,
//       viewingCenterY: 0,
//     }
//   }

//   componentWillUnmount() {
//     this.timerID && clearTimeout(this.timerID)
//   }

//   private filePickerFiles = () => (this.file && this.file.files) || []

//   private filePickerOpen = () => {
//     this.file && this.file.click()
//   }

//   private filePickerSetRef = (r: HTMLInputElement | null) => {
//     this.file = r
//   }

//   private filePickerSetValue = (value: string) => {
//     if (this.file) this.file.value = value
//   }

//   private pickFile = () => {
//     this.setState({error: false, loading: true})
//     const fileList = this.filePickerFiles()
//     const paths: Array<string> = fileList.length
//       ? Array.prototype.map
//           .call(fileList, (f: File) => {
//             // We rely on path being here, even though it's not part of the File spec.
//             const path: string = f.path
//             return path
//           })
//           .filter(Boolean)
//       : ([] as any)
//     if (paths) {
//       const img = paths.pop()
//       img && this.paintImage(img)
//     }
//     this.filePickerSetValue('')
//   }

//   private onDragLeave = () => {
//     this.setState({dropping: false})
//   }

//   private onDrop = async (e: React.DragEvent<any>) => {
//     this.setState({dropping: false, error: false, loading: true})
//     if (!this.validDrag(e)) {
//       return
//     }
//     const fileList = e.dataTransfer.files
//     const paths: Array<string> = fileList.length
//       ? Array.prototype.map.call(fileList, f => f.path)
//       : ([] as any)
//     if (paths.length) {
//       // TODO: Show an error when there's more than one path.
//       for (const path of paths) {
//         // Check if any file is a directory and bail out if not
//         try {
//           const isDir = await (isDirectory?.(path) ?? Promise.resolve(false))
//           if (isDir) {
//             // TODO: Show a red error banner on failure: https://zpl.io/2jlkMLm
//             return
//           }
//         } catch (e) {
//           // TODO: Show a red error banner on failure: https://zpl.io/2jlkMLm
//         }
//       }
//       const img = paths.pop()
//       img && this.paintImage(img)
//     }
//   }

//   private validDrag = (e: React.DragEvent<any>) => {
//     return Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')
//   }

//   private onDragOver = (e: React.DragEvent<any>) => {
//     this.setState({dropping: true})
//     if (this.validDrag(e)) {
//       e.dataTransfer.dropEffect = 'copy'
//     } else {
//       e.dataTransfer.dropEffect = 'none'
//     }
//   }

//   private paintImage = (path: string) => {
//     this.setState({imageSource: path})
//   }

//   private onImageError = () => {
//     this.setState({error: true, hasPreview: false, loading: false})
//   }

//   private onImageLoad = (/*e: React.BaseSyntheticEvent*/) => {
//     // TODO: Make RPC to check file size and warn them before they try submitting.

//     // let height = AVATAR_SIZE
//     // let width = (AVATAR_SIZE * e.currentTarget.naturalWidth) / e.currentTarget.naturalHeight

//     // if (width < AVATAR_SIZE) {
//     //   height = (AVATAR_SIZE * e.currentTarget.naturalHeight) / e.currentTarget.naturalWidth
//     //   width = AVATAR_SIZE
//     // }

//     this.setState({
//       // naturalImageWidth: e.currentTarget.naturalWidth,
//       // offsetLeft: width / -2 + VIEWPORT_CENTER,
//       // offsetTop: height / -2 + VIEWPORT_CENTER,
//       // scaledImageHeight: height,
//       // scaledImageWidth: width,
//       // startingImageHeight: height,
//       // startingImageWidth: width,
//       // viewingCenterX: e.currentTarget.naturalWidth / 2,
//       // viewingCenterY: e.currentTarget.naturalHeight / 2,
//       hasPreview: true,
//       loading: false,
//     })

//     // this.timerID = setTimeout(() => {
//     //   this.setState({
//     //     hasPreview: true,
//     //     loading: false,
//     //   })
//     // }, 1500)
//   }

//   private onRangeChange = (e: React.FormEvent<any>) => {
//     const scale = parseFloat(e.currentTarget.value)
//     console.log('aaa range', scale)
//     // likely unsafe to ref this.state but afraid to change this now
//     // eslint-disable-next-line
//     const scaledImageHeight = this.state.startingImageHeight * scale
//     // eslint-disable-next-line
//     const scaledImageWidth = this.state.startingImageWidth * scale

//     const ratio = this.state.naturalImageWidth / scaledImageWidth
//     const offsetLeft = clamp(
//       // eslint-disable-next-line
//       VIEWPORT_CENTER - this.state.viewingCenterX / ratio,
//       AVATAR_SIZE - scaledImageWidth,
//       0
//     )
//     const offsetTop = clamp(
//       // eslint-disable-next-line
//       VIEWPORT_CENTER - this.state.viewingCenterY / ratio,
//       AVATAR_SIZE - scaledImageHeight,
//       0
//     )

//     this.setState({
//       offsetLeft,
//       offsetTop,
//       scale,
//       scaledImageHeight,
//       scaledImageWidth,
//     })
//   }

//   private onMouseDown = (e: React.MouseEvent) => {
//     if (!this.state.hasPreview || !this.imageRef) return

//     // Grab the values now. The event object will be nullified by the time setState is called.
//     const {pageX, pageY} = e

//     const img = this.imageRef.current

//     this.setState(s => ({
//       dragStartX: pageX,
//       dragStartY: pageY,
//       // @ts-ignore codemode issue
//       dragStopX: img && img.style.left ? parseInt(img.style.left, 10) : s.dragStopX,
//       // @ts-ignore codemode issue
//       dragStopY: img && img.style.top ? parseInt(img.style.top, 10) : s.dragStopY,
//       dragging: true,
//     }))
//   }

//   private onMouseUp = () => {
//     if (!this.state.hasPreview || !this.imageRef) return

//     const img = this.imageRef.current

//     this.setState(s => ({
//       // @ts-ignore codemode issue
//       dragStopX: img && img.style.left ? parseInt(img.style.left, 10) : s.dragStopX,
//       // @ts-ignore codemode issue
//       dragStopY: img && img.style.top ? parseInt(img.style.top, 10) : s.dragStopY,
//       dragging: false,
//     }))
//   }

//   private onMouseMove = (e: React.MouseEvent) => {
//     if (!this.state.dragging || this.props.submitting) return

//     // Grab the values now. The event object will be nullified by the time setState is called.
//     const {pageX, pageY} = e

//     const offsetLeft = clamp(
//       // eslint-disable-next-line
//       this.state.dragStopX + pageX - this.state.dragStartX,
//       // eslint-disable-next-line
//       AVATAR_SIZE - this.state.scaledImageWidth,
//       0
//     )
//     const offsetTop = clamp(
//       // eslint-disable-next-line
//       this.state.dragStopY + pageY - this.state.dragStartY,
//       // eslint-disable-next-line
//       AVATAR_SIZE - this.state.scaledImageHeight,
//       0
//     )

//     const ratio = this.state.naturalImageWidth / this.state.scaledImageWidth
//     // eslint-disable-next-line
//     const viewingCenterX = (VIEWPORT_CENTER - this.state.offsetLeft) * ratio
//     // eslint-disable-next-line
//     const viewingCenterY = (VIEWPORT_CENTER - this.state.offsetTop) * ratio

//     this.setState({
//       offsetLeft,
//       offsetTop,
//       viewingCenterX,
//       viewingCenterY,
//     })
//   }

//   private onSave = () => {
//     const x = this.state.offsetLeft * -1
//     const y = this.state.offsetTop * -1
//     const ratio =
//       this.state.scaledImageWidth !== 0 ? this.state.naturalImageWidth / this.state.scaledImageWidth : 1
//     const crop = {
//       x0: Math.round(x * ratio),
//       x1: Math.round((x + AVATAR_SIZE) * ratio),
//       y0: Math.round(y * ratio),
//       y1: Math.round((y + AVATAR_SIZE) * ratio),
//     }

//     if (this.props.wizard) {
//       return this.props.onSave(
//         this.state.imageSource,
//         crop,
//         this.state.scaledImageWidth,
//         this.state.offsetLeft,
//         this.state.offsetTop
//       )
//     }

//     this.props.onSave(this.state.imageSource, crop)
//   }

//   private onChanged = e => {
//     console.log('aaa on changed', e)
//   }

//   render() {
//     console.log('aaa rendering', this.state.scale)
//     return (
//       <Kb.Modal
//         mode="DefaultFullHeight"
//         onClose={this.props.onClose}
//         header={{
//           leftButton:
//             this.props.wizard || this.props.showBack ? (
//               <Kb.Icon type="iconfont-arrow-left" onClick={this.props.onBack} />
//             ) : null,
//           rightButton: this.props.wizard ? (
//             <Kb.Button
//               label="Skip"
//               mode="Secondary"
//               onClick={this.props.onSkip}
//               style={styles.skipButton}
//               type="Default"
//             />
//           ) : null,
//           title:
//             this.props.type === 'team' ? (
//               <ModalTitle teamID={this.props.teamID} title="Upload an avatar" />
//             ) : (
//               'Upload an avatar'
//             ),
//         }}
//         allowOverflow={true}
//         footer={{
//           content: (
//             <Kb.WaitingButton
//               fullWidth={true}
//               label={this.props.wizard ? 'Continue' : 'Save'}
//               onClick={this.onSave}
//               disabled={!this.state.hasPreview}
//               waitingKey={null}
//             />
//           ),
//         }}
//         banners={
//           <>
//             {this.props.error ? (
//               <Kb.Banner color="red" key="propsError">
//                 {this.props.error}
//               </Kb.Banner>
//             ) : null}
//             {this.state.error ? (
//               <Kb.Banner color="red" key="stateError">
//                 The image you uploaded could not be read. Try again with a valid PNG, JPG or GIF.
//               </Kb.Banner>
//             ) : null}
//           </>
//         }
//       >
//         <Kb.Box
//           className={Styles.classNames({dropping: this.state.dropping})}
//           onDragLeave={this.onDragLeave}
//           onDragOver={this.onDragOver}
//           onDrop={this.onDrop}
//           style={Styles.collapseStyles([
//             styles.container,
//             this.props.createdTeam && styles.paddingTopForCreatedTeam,
//           ])}
//           onMouseUp={this.onMouseUp}
//           onMouseDown={this.onMouseDown}
//           onMouseMove={this.onMouseMove}
//         >
//           {this.props.type === 'team' && this.props.createdTeam && !this.props.wizard && (
//             <Kb.Box style={styles.createdBanner}>
//               <Kb.Text type="BodySmallSemibold" negative={true}>
//                 Hoorah! Your team {this.props.teamname} was created.
//               </Kb.Text>
//             </Kb.Box>
//           )}
//           <Kb.Text center={true} type="Body" style={styles.instructions}>
//             Drag and drop a {this.props.type} avatar or{' '}
//             <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={this.filePickerOpen}>
//               browse your computer
//             </Kb.Text>{' '}
//             for one.
//           </Kb.Text>
//           <Kb.Box
//             className={Styles.classNames('hoverbox', {filled: this.state.hasPreview})}
//             onClick={this.state.hasPreview ? null : this.filePickerOpen}
//             style={{
//               borderRadius: this.props.type === 'team' ? 32 : AVATAR_CONTAINER_SIZE,
//               ...hoverStyles.hoverContainer,
//             }}
//           >
//             <input
//               accept="image/gif,image/jpeg,image/png"
//               multiple={false}
//               onChange={this.pickFile}
//               ref={this.filePickerSetRef}
//               style={styles.hidden}
//               type="file"
//             />
//             {this.state.loading && (
//               <Kb.Box2 direction="vertical" fullHeight={true} style={styles.spinnerContainer}>
//                 <Kb.ProgressIndicator type="Large" style={styles.spinner} />
//               </Kb.Box2>
//             )}
//             <Kb.ZoomableImage
//               zoomRatio={this.state.scale}
//               dragPan={true}
//               src={this.state.imageSource}
//               onChanged={this.onChanged}
//               onLoaded={this.onImageLoad}
//             />
//             {!this.state.loading && !this.state.hasPreview && (
//               <Kb.Icon
//                 className="icon"
//                 color={Styles.globalColors.greyDark}
//                 fontSize={48}
//                 style={styles.icon}
//                 type="iconfont-camera"
//               />
//             )}
//           </Kb.Box>
//           {this.state.hasPreview && (
//             <input
//               disabled={!this.state.hasPreview || this.props.submitting}
//               min={1}
//               max={10}
//               onChange={this.onRangeChange}
//               onMouseMove={e => e.stopPropagation()}
//               step="any"
//               type="range"
//               value={this.state.scale}
//             />
//           )}
//         </Kb.Box>
//       </Kb.Modal>
//     )
//   }
// }

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
          alignItems: 'flex-start',
          height: AVATAR_CONTAINER_SIZE,
          marginBottom: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.medium,
          outlineStyle: 'dotted',
          outlineWidth: AVATAR_BORDER_SIZE,
          // overflow: 'hidden',
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

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flexGrow: 1,
    paddingTop: Styles.globalMargins.small,
  },
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
  instructions: {maxWidth: 200},
  paddingTopForCreatedTeam: {paddingTop: Styles.globalMargins.xlarge},
  skipButton: {minWidth: 60},
  spinner: {alignSelf: 'center'},
  spinnerContainer: {
    backgroundColor: Styles.globalColors.grey,
    justifyContent: 'center',
  },
}))

export default EditAvatar
