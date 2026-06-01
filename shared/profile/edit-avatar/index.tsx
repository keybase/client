import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from './index.shared'
import {useNavigation} from '@react-navigation/native'
import {useSafeNavigation} from '@/util/safe-navigation'
import {ModalTitle} from '@/teams/common'
import useHooks from './hooks'
import './edit-avatar.css'
import KB2 from '@/util/electron'
import {launchImageLibraryAsync} from '@/util/expo-image-picker'
import {CropZoom, type CropZoomRefType} from '@/util/zoom-toolkit'

const desktopFns = isMobile ? ({} as typeof KB2.functions) : KB2.functions

const AVATAR_CONTAINER_SIZE = 300

// Local type stubs for DOM APIs (native tsconfig lacks dom lib)
type FileLike = {name?: string; size?: number; type?: string}
type FileListLike = {length?: number; [key: number]: FileLike; [Symbol.iterator]?: () => Iterator<FileLike>}
type FileInputRef = {click?: () => void; files?: FileListLike | null; value?: string}

// Desktop helpers
const validDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

const getFile = async (fileList: FileListLike | undefined): Promise<string> => {
  const {isDirectory, getPathForFile} = desktopFns
  const paths = fileList?.length ? Array.from(fileList as unknown as Iterable<FileLike>) : undefined
  const file = paths?.[0]
  if (!file) {
    return ''
  }
  const path = getPathForFile?.(file as unknown as File) ?? ''
  if (!path) {
    return ''
  }
  try {
    const isDir = await (isDirectory?.(path) ?? Promise.resolve(false))
    if (isDir) {
      return ''
    }
  } catch {}
  return path
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
  x0 = Math.min(Math.max(Math.round(x0), 0), maxX)
  const x1 = Math.min(x0 + windowScaled, maxX)
  let y0 = y / scale
  y0 = Math.min(Math.max(Math.round(y0), 0), maxY)
  const y1 = Math.min(y0 + windowScaled, maxY)
  return {x0, x1, y0, y1}
}

// Desktop implementation
type Loading = undefined | 'loading' | 'loaded'
const DesktopEditAvatar = (_p: Props) => {
  const p = useHooks(_p)
  const {wizard, type, error, createdTeam, teamname} = p
  const [serror, setSerror] = React.useState(false)
  const [dropping, setDropping] = React.useState(false)
  const [loading, setLoading] = React.useState<Loading>()
  const [imageSource, setImageSource] = React.useState('')

  const fileRef = React.useRef<FileInputRef>(null)

  const onSave = () => {
    const crop = getCropCoordinates(cropRef.current)
    p.onSave(imageSource, crop)
  }
  const cropRef = React.useRef({height: 0, scale: 0, width: 0, x: 0, y: 0})
  const onChanged = (e: Crop) => {
    cropRef.current = e
  }

  const onImageLoad = () => {
    setLoading('loaded')
  }
  const onDrop = (e: React.DragEvent) => {
    const f = async () => {
      if (!validDrag(e)) {
        return
      }
      setDropping(false)
      setSerror(false)
      setLoading('loading')
      const img = await getFile(e.dataTransfer.files as unknown as FileListLike)
      if (img) {
        setImageSource(img)
      }
    }
    void f()
  }
  const filePickerOpen = () => {
    fileRef.current?.click?.()
  }
  const pickFile = () => {
    const f = async () => {
      setSerror(false)
      setLoading('loading')
      const img = await getFile(fileRef.current?.files ?? undefined)
      if (img) {
        setImageSource(img)
      }
      if (fileRef.current) {
        fileRef.current.value = ''
      }
    }
    void f()
  }

  return (
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
      <div
        className={Kb.Styles.classNames({dropping: dropping})}
        onDrop={onDrop}
        style={Kb.Styles.castStyleDesktop(Kb.Styles.collapseStyles([
          styles.container,
          createdTeam && styles.paddingTopForCreatedTeam,
        ]))}
      >
        {type === 'team' && createdTeam && !wizard && (
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.createdBanner}>
            <Kb.Text type="BodySmallSemibold" negative={true}>
              Hoorah! Your team {teamname} was created.
            </Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Text center={true} type="Body" style={styles.instructions}>
          Drag and drop a {type} avatar or{' '}
          <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={filePickerOpen}>
            browse your computer
          </Kb.Text>{' '}
          for one.
        </Kb.Text>
        <Kb.ClickableBox
          direction="vertical"
          className={Kb.Styles.classNames('hoverbox', {filled: loading !== 'loaded'})}
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
            ref={fileRef as React.RefObject<HTMLInputElement>}
            style={styles.hidden}
            type="file"
          />
          <Kb.ZoomableImage
            dragPan={true}
            src={imageSource}
            onChanged={onChanged}
            onLoaded={onImageLoad}
            boxCacheKey="avatar"
          />
          {!loading && (
            <Kb.Icon
              className="icon"
              color={Kb.Styles.globalColors.greyDark}
              fontSize={48}
              style={styles.icon}
              type="iconfont-camera"
            />
          )}
        </Kb.ClickableBox>
        {loading === 'loaded' ? <Kb.Text type="Body">Click to select. Scroll to zoom.</Kb.Text> : null}
      </div>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.WaitingButton
          fullWidth={true}
          label={wizard ? 'Continue' : 'Save'}
          onClick={onSave}
          disabled={loading !== 'loaded'}
          waitingKey={p.waitingKey}
        />
      </Kb.Box2>
    </>
  )
}

// Native implementation
type ImageInfo = {uri: string; width: number; height: number; type?: 'image' | 'video'}
type AvatarZoomRef = {
  getRect: () => {width: number; height: number; x: number; y: number} | undefined
}

const NativeAvatarUploadWrapper = (p: Props) => {
  const {newTeamWizard} = p
  const props = useHooks(p)
  const {image, error: _error, onSave: _onSave, teamID, type, wizard, waitingKey} = props
  const [selectedImage, setSelectedImage] = React.useState(image)
  const [imageError, setImageError] = React.useState('')
  const nav = useSafeNavigation()
  const navigation = useNavigation()
  const navUp = () => nav.safeNavigateUp()

  const onChooseNewAvatar = () => {
    const f = async () => {
      try {
        const result = await launchImageLibraryAsync('photo')
        const first = result.assets?.reduce<ImageInfo | undefined>((acc, a) => {
          if (!acc && (a.type === 'image' || a.type === 'video')) {
            return a as ImageInfo
          }
          return acc
        }, undefined)
        if (!result.canceled && first) {
          setSelectedImage(first)
        } else if (!props.wizard) {
          navUp()
        }
      } catch (error) {
        setImageError(String(error))
      }
    }
    C.ignorePromise(f())
  }

  const noImage = !image
  React.useEffect(() => {
    if (!wizard && noImage) {
      const f = async () => {
        try {
          const result = await launchImageLibraryAsync('photo')
          const first = result.assets?.reduce<ImageInfo | undefined>((acc, a) => {
            if (!acc && (a.type === 'image' || a.type === 'video')) {
              return a as ImageInfo
            }
            return acc
          }, undefined)
          if (!result.canceled && first) {
            setSelectedImage(first)
          } else {
            nav.safeNavigateUp()
          }
        } catch (error) {
          setImageError(String(error))
        }
      }
      C.ignorePromise(f())
    }
  }, [noImage, wizard, nav])

  const error = _error || imageError

  const _zoomRef = React.useRef<AvatarZoomRef>(null)

  const avatar_size = () => {
    const margin = type === 'team' ? Kb.Styles.globalMargins.large : Kb.Styles.globalMargins.medium
    const big = Kb.Styles.dimensionWidth - margin * 2
    if (C.isTablet) {
      return Math.min(500, big)
    } else {
      return big
    }
  }

  const onSave = () => {
    if (!selectedImage) {
      throw new Error('Missing image when saving avatar')
    }
    const rect = _zoomRef.current?.getRect()
    if (rect) {
      const xy = {
        x0: Math.floor(rect.x),
        x1: Math.floor(rect.x + rect.width),
        y0: Math.floor(rect.y),
        y1: Math.floor(rect.y + rect.height),
      }
      _onSave(selectedImage.uri, xy)
    } else {
      _onSave(selectedImage.uri)
    }
  }

  const getImageStyle = (): Kb.Styles.StylesCrossPlatform => ({
    borderRadius: type === 'team' ? 32 : avatar_size(),
    height: avatar_size(),
    width: avatar_size(),
  })

  const renderImageZoomer = () => {
    if (type === 'team' && !selectedImage) {
      return (
        <Kb.ClickableBox
          direction="vertical"
          centerChildren={true}
          style={Kb.Styles.collapseStyles([styles.placeholder, getImageStyle()])}
          onClick={onChooseNewAvatar}
        >
          <Kb.Icon type="iconfont-camera" sizeType="Huge" color={Kb.Styles.globalColors.black_10} />
        </Kb.ClickableBox>
      )
    }
    return selectedImage ? (
      <NativeAvatarZoom
        src={selectedImage.uri}
        width={selectedImage.width}
        height={selectedImage.height}
        ref={_zoomRef}
      />
    ) : null
  }

  React.useEffect(() => {
    const hasImage = !!selectedImage
    navigation.setOptions({
      headerTitle: () => {
        if (teamID) {
          const title = hasImage && isIOS ? 'Zoom and pan' : wizard ? 'Upload avatar' : 'Change avatar'
          if (isMobile) {
            return <ModalTitle teamID={teamID} title={title} newTeamWizard={newTeamWizard} />
          }
          return <Kb.Text type="BodyBig">{title}</Kb.Text>
        }
        return <Kb.Text type="BodyBig">Upload an avatar</Kb.Text>
      },
    })
  }, [navigation, newTeamWizard, selectedImage, teamID, wizard])

  if (type === 'team') {
    return (
      <>
        {error ? (
          <Kb.Banner key="err" color="red">
            <Kb.Text type="Body">{error}</Kb.Text>
          </Kb.Banner>
        ) : null}
        <Kb.Box2 direction="vertical" style={styles.wizardContainer} gap="small">
          {renderImageZoomer()}
          <Kb.Box2 direction="vertical" style={styles.flexReallyGrow} />
          <Kb.Button
            label={selectedImage ? 'Pick a new avatar' : 'Pick an avatar'}
            mode="Secondary"
            onClick={onChooseNewAvatar}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.WaitingButton
            fullWidth={true}
            label={wizard ? 'Continue' : 'Save'}
            onClick={onSave}
            disabled={!selectedImage}
            waitingKey={waitingKey}
          />
        </Kb.Box2>
      </>
    )
  }
  return (
    <>
      {error ? (
        <Kb.Banner color="red">
          <Kb.Text type="Body">{error}</Kb.Text>
        </Kb.Banner>
      ) : null}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        {renderImageZoomer()}
        <Kb.ButtonBar direction="column">
          <Kb.WaitingButton
            fullWidth={true}
            label="Save"
            onClick={onSave}
            style={styles.button}
            waitingKey={waitingKey}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const avatarSize = 256
const cropSize = {height: avatarSize, width: avatarSize}

function NativeAvatarZoom(p: {src?: string; width: number; height: number; ref?: React.Ref<AvatarZoomRef>}) {
  const {src, width, height, ref} = p
  const resolution = {height, width}


  React.useImperativeHandle(ref, () => {
    return {
      getRect: () => {
        const c = czref.current?.crop(avatarSize)
        if (c) {
          const rescale = width / (c.resize?.width ?? 1)
          const {originX: x, originY: y, width: cw, height: ch} = c.crop
          return {
            height: ch * rescale,
            width: cw * rescale,
            x: x * rescale,
            y: y * rescale,
          }
        }
        return
      },
    }
  }, [width])
  const czref = React.useRef<CropZoomRefType>(null)

  const imageAspectRatio = resolution.width / resolution.height
  const isWider = imageAspectRatio > 1

  const imageStyle = isWider
    ? {
        height: avatarSize,
        width: avatarSize * imageAspectRatio,
      }
    : {
        height: avatarSize / imageAspectRatio,
        width: avatarSize,
      }

  return (
    <Kb.Box2
      direction="vertical"
      overflow="hidden"
      style={{
        borderRadius: avatarSize / 2,
        ...Kb.Styles.size(avatarSize),
      }}
    >
      {src ? (
        <CropZoom cropSize={cropSize} resolution={resolution} ref={czref} panMode="clamp" minScale={1}>
          <Kb.Image src={src} style={imageStyle} />
        </CropZoom>
      ) : null}
    </Kb.Box2>
  )
}

const AvatarUploadWrapper = (p: Props) => {
  if (!isMobile) return <DesktopEditAvatar {...p} />
  return <NativeAvatarUploadWrapper {...p} />
}

const hoverStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      hoverContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          ...Kb.Styles.size(AVATAR_CONTAINER_SIZE),
          marginBottom: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.medium,
          outlineStyle: 'dotted',
          outlineWidth: 4,
          overflow: 'hidden',
          position: 'relative',
        },
        isElectron: {
          cursor: 'pointer',
        },
      }),
    }) as const
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: {
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flexGrow: 1,
    },
    isMobile: {
      ...Kb.Styles.padding(0, Kb.Styles.globalMargins.medium),
      ...Kb.Styles.marginV(Kb.Styles.globalMargins.small),
    },
    isElectron: {
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  createdBanner: {
    backgroundColor: Kb.Styles.globalColors.green,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: Kb.Styles.globalMargins.large,
    ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xsmall),
    textAlign: 'center',
    width: '100%',
  },
  flexReallyGrow: {
    flexGrow: 1000,
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
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      ...Kb.Styles.topDivider(),
    },
    isElectron: {
      ...Kb.Styles.roundedBottom(),
    },
  }),
  paddingTopForCreatedTeam: {paddingTop: Kb.Styles.globalMargins.xlarge},
  placeholder: {
    alignItems: 'center',
    backgroundColor: Kb.Styles.globalColors.black_05,
    borderColor: Kb.Styles.globalColors.black_50,
    borderStyle: 'dotted',
    borderWidth: 4,
    display: 'flex',
    justifyContent: 'center',
  },
  wizardContainer: {
    ...Kb.Styles.padding(64, Kb.Styles.globalMargins.large),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    flex: 1,
  },
}))

export default AvatarUploadWrapper
