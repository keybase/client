import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {type Props} from '.'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {ModalTitle} from '@/teams/common'
import {useSafeNavigation} from '@/util/safe-navigation'
import {CropZoom, type CropZoomRefType} from 'react-native-zoom-toolkit'
import useHooks from './hooks'

const AvatarUploadWrapper = (p: Props) => {
  const props = useHooks(p)
  const {image, error: _error, onSave: _onSave, type} = props
  const {onBack, wizard, waitingKey, onClose, onSkip, teamID} = props
  const [selectedImage, setSelectedImage] = React.useState(image)
  const [imageError, setImageError] = React.useState('')
  const nav = useSafeNavigation()
  const navUp = React.useCallback(() => nav.safeNavigateUp(), [nav])

  const onChooseNewAvatar = React.useCallback(() => {
    const f = async () => {
      try {
        const result = await launchImageLibraryAsync('photo')
        const first = result.assets?.reduce<typeof image>((acc, a) => {
          if (!acc && (a.type === 'image' || a.type === 'video')) {
            return a as typeof image
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
  }, [setImageError, setSelectedImage, navUp, props.wizard])

  const noImage = !image
  React.useEffect(() => {
    if (!props.wizard && noImage) {
      onChooseNewAvatar()
    }
  }, [noImage, props.wizard, onChooseNewAvatar])

  const error = _error || imageError

  const _zoomRef = React.useRef<AvatarZoomRef>(null)

  const avatar_size = React.useCallback(() => {
    const margin = type === 'team' ? Kb.Styles.globalMargins.large : Kb.Styles.globalMargins.medium
    const big = Kb.Styles.dimensionWidth - margin * 2
    if (C.isTablet) {
      return Math.min(500, big)
    } else {
      return big
    }
  }, [type])

  const onSave = React.useCallback(() => {
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
  }, [selectedImage, _onSave])

  const getImageStyle = React.useCallback(
    (): Kb.Styles.StylesCrossPlatform => ({
      borderRadius: type === 'team' ? 32 : avatar_size(),
      height: avatar_size(),
      width: avatar_size(),
    }),
    [type, avatar_size]
  )

  const renderImageZoomer = React.useCallback(() => {
    if (type === 'team' && !selectedImage) {
      return (
        <Kb.ClickableBox
          style={Kb.Styles.collapseStyles([styles.placeholder, getImageStyle()])}
          onClick={onChooseNewAvatar}
        >
          <Kb.Icon type="iconfont-camera" sizeType="Huge" color={Kb.Styles.globalColors.black_10} />
        </Kb.ClickableBox>
      )
    }
    return selectedImage ? (
      <AvatarZoom
        src={selectedImage.uri}
        width={selectedImage.width}
        height={selectedImage.height}
        ref={_zoomRef}
      />
    ) : null
  }, [type, selectedImage, onChooseNewAvatar, getImageStyle])

  if (type === 'team') {
    return (
      <Kb.Modal
        banners={
          error ? (
            <Kb.Banner key="err" color="red">
              <Kb.Text type="Body">{error}</Kb.Text>
            </Kb.Banner>
          ) : null
        }
        header={{
          leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
          rightButton: wizard ? (
            <Kb.Text type="BodyBigLink" onClick={onSkip}>
              Skip
            </Kb.Text>
          ) : undefined,

          title: (
            <ModalTitle
              teamID={teamID ?? ''}
              title={selectedImage && C.isIOS ? 'Zoom and pan' : wizard ? 'Upload avatar' : 'Change avatar'}
            />
          ),
        }}
        footer={{
          content: (
            <Kb.WaitingButton
              fullWidth={true}
              label={wizard ? 'Continue' : 'Save'}
              onClick={onSave}
              disabled={!selectedImage}
              waitingKey={waitingKey}
            />
          ),
        }}
      >
        <Kb.Box2 direction="vertical" style={styles.wizardContainer} fullHeight={true} gap="small">
          {renderImageZoomer()}
          <Kb.Box style={styles.flexReallyGrow} />
          <Kb.Button
            label={selectedImage ? 'Pick a new avatar' : 'Pick an avatar'}
            mode="Secondary"
            onClick={onChooseNewAvatar}
          />
        </Kb.Box2>
      </Kb.Modal>
    )
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader onCancel={onClose} title={C.isIOS ? 'Zoom and pan' : 'Upload avatar'} />
      {error ? (
        <Kb.Banner color="red">
          <Kb.Text type="Body">{error}</Kb.Text>
        </Kb.Banner>
      ) : null}
      <Kb.Box style={styles.container}>
        <Kb.Box>{renderImageZoomer()}</Kb.Box>
        <Kb.ButtonBar direction="column">
          <Kb.WaitingButton
            fullWidth={true}
            label="Save"
            onClick={onSave}
            style={styles.button}
            waitingKey={waitingKey}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Kb.Box2>
  )
}

const avatarSize = 256
const cropSize = {height: avatarSize, width: avatarSize}

type AvatarZoomRef = {
  getRect: () => {width: number; height: number; x: number; y: number} | undefined
}

const AvatarZoom = React.forwardRef<AvatarZoomRef, {src?: string; width: number; height: number}>(
  function AvatarZoom(p, ref) {
    const {src, width, height} = p
    const resolution = React.useMemo(() => {
      return {height, width}
    }, [width, height])

    React.useImperativeHandle(ref, () => {
      // we don't use this in mobile for now, and likely never
      return {
        getRect: () => {
          const c = czref.current?.crop(avatarSize)
          if (c) {
            const rescale = resolution.width / (c.resize?.width ?? 1)
            const {originX: x, originY: y, width, height} = c.crop
            return {
              height: height * rescale,
              width: width * rescale,
              x: x * rescale,
              y: y * rescale,
            }
          }
          return
        },
      }
    }, [resolution])
    const czref = React.useRef<CropZoomRefType>(null)

    const imageStyle = React.useMemo(() => {
      // For CropZoom, we want the image to always cover the crop area
      // So we fit to the larger dimension to ensure coverage
      const imageAspectRatio = resolution.width / resolution.height
      const isWider = imageAspectRatio > 1

      if (isWider) {
        // Image is wider - fit to height so it covers vertically
        return {
          height: avatarSize,
          width: avatarSize * imageAspectRatio,
        }
      } else {
        // Image is taller - fit to width so it covers horizontally
        return {
          height: avatarSize / imageAspectRatio,
          width: avatarSize,
        }
      }
    }, [resolution])

    return (
      <Kb.Box2
        direction="vertical"
        style={{
          borderRadius: avatarSize / 2,
          height: avatarSize,
          overflow: 'hidden',
          width: avatarSize,
        }}
      >
        {src ? (
          <CropZoom cropSize={cropSize} resolution={resolution} ref={czref} panMode="clamp" minScale={1}>
            <Kb.Image2 src={src} style={imageStyle} />
          </CropZoom>
        ) : null}
      </Kb.Box2>
    )
  }
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {
        marginTop: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
      container: {
        ...Kb.Styles.padding(0, Kb.Styles.globalMargins.medium),
        marginBottom: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      flexReallyGrow: {
        flexGrow: 1000,
      },
      image: {
        overflow: 'hidden',
        position: 'relative',
      },
      placeholder: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.black_05,
        borderColor: Kb.Styles.globalColors.black_50,
        borderStyle: 'dotted',
        borderWidth: 4,
        display: 'flex',
        justifyContent: 'center',
      },
      standardScreen: {...Kb.Styles.padding(0), flexGrow: 1},
      wizardContainer: {
        ...Kb.Styles.padding(64, Kb.Styles.globalMargins.large),
        backgroundColor: Kb.Styles.globalColors.blueGrey,
      },
      zoomContainer: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.grey,
          marginBottom: Kb.Styles.globalMargins.tiny,
          overflow: 'hidden',
          position: 'relative',
        },
        isTablet: {alignSelf: 'center'},
      }),
    }) as const
)

export default AvatarUploadWrapper
