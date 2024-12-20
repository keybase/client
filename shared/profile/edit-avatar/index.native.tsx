import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {type Props} from '.'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {ModalTitle} from '@/teams/common'
import * as Container from '@/util/container'
import {CropZoom, useImageResolution, type CropZoomType} from 'react-native-zoom-toolkit'

type WrappedProps = {
  onChooseNewAvatar: () => void
}

const AvatarUploadWrapper = (props: Props) => {
  const {image, error, ...rest} = props
  const [selectedImage, setSelectedImage] = React.useState(image)
  const [imageError, setImageError] = React.useState('')
  const nav = Container.useSafeNavigation()
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

  const combinedError = error || imageError

  return (
    <AvatarUpload
      {...rest}
      image={selectedImage}
      onChooseNewAvatar={onChooseNewAvatar}
      error={combinedError}
    />
  )
}

const avatarSize = 256
const cropSize = {height: avatarSize, width: avatarSize}

type AvatarZoomRef = {
  getRect: () => {width: number; height: number; x: number; y: number} | undefined
}

const AvatarZoom = React.forwardRef<AvatarZoomRef, {src: string}>((p, ref) => {
  const {src} = p
  const {resolution} = useImageResolution({uri: src})

  React.useImperativeHandle(ref, () => {
    // we don't use this in mobile for now, and likely never
    return {
      getRect: () => {
        const c = czref.current?.crop(avatarSize)
        if (c && resolution) {
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
  const czref = React.useRef<CropZoomType>(null)

  if (!resolution) {
    return null
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={{borderRadius: avatarSize / 2, height: avatarSize, overflow: 'hidden', width: avatarSize}}
    >
      <CropZoom cropSize={cropSize} resolution={resolution} ref={czref}>
        <Kb.Image2 src={src} style={{height: '100%', width: '100%'}} />
      </CropZoom>
    </Kb.Box2>
  )
})

class AvatarUpload extends React.Component<Props & WrappedProps> {
  _zoomRef = React.createRef<AvatarZoomRef>()

  private avatar_size = (): number => {
    const margin = this.props.type === 'team' ? Kb.Styles.globalMargins.large : Kb.Styles.globalMargins.medium
    const big = Kb.Styles.dimensionWidth - margin * 2
    if (C.isTablet) {
      return Math.min(500, big)
    } else {
      return big
    }
  }

  private onSave = () => {
    if (!this.props.image) {
      throw new Error('Missing image when saving avatar')
    }
    const rect = this._zoomRef.current?.getRect()
    if (rect) {
      const xy = {
        x0: Math.floor(rect.x),
        x1: Math.floor(rect.x + rect.width),
        y0: Math.floor(rect.y),
        y1: Math.floor(rect.y + rect.height),
      }
      this.props.onSave(this.props.image.uri, xy)
    } else {
      this.props.onSave(this.props.image.uri)
    }
  }

  _imageDimensions = () => {
    if (!this.props.image) return

    const AVATAR_SIZE = this.avatar_size()
    let height = AVATAR_SIZE
    let width = (AVATAR_SIZE * this.props.image.width) / this.props.image.height

    if (width < AVATAR_SIZE) {
      height = (AVATAR_SIZE * this.props.image.height) / this.props.image.width
      width = AVATAR_SIZE
    }

    return {height, width}
  }

  private getImageStyle = (): Kb.Styles.StylesCrossPlatform => ({
    borderRadius: this.props.type === 'team' ? 32 : this.avatar_size(),
    height: this.avatar_size(),
    width: this.avatar_size(),
  })

  private renderImageZoomer() {
    if (this.props.type === 'team' && !this.props.image) {
      return (
        <Kb.ClickableBox
          style={Kb.Styles.collapseStyles([styles.placeholder, this.getImageStyle()])}
          onClick={this.props.onChooseNewAvatar}
        >
          <Kb.Icon type="iconfont-camera" sizeType="Huge" color={Kb.Styles.globalColors.black_10} />
        </Kb.ClickableBox>
      )
    }
    const uri = this.props.image?.uri
    return uri ? <AvatarZoom src={uri} ref={this._zoomRef} /> : null
  }

  render() {
    if (this.props.type === 'team') {
      return (
        <Kb.Modal
          banners={
            this.props.error ? (
              <Kb.Banner key="err" color="red">
                <Kb.Text type="Body">{this.props.error}</Kb.Text>
              </Kb.Banner>
            ) : null
          }
          header={{
            leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={this.props.onBack} />,
            rightButton: this.props.wizard ? (
              <Kb.Text type="BodyBigLink" onClick={this.props.onSkip}>
                Skip
              </Kb.Text>
            ) : undefined,

            title: (
              <ModalTitle
                teamID={this.props.teamID}
                title={
                  this.props.image && C.isIOS
                    ? 'Zoom and pan'
                    : this.props.wizard
                      ? 'Upload avatar'
                      : 'Change avatar'
                }
              />
            ),
          }}
          footer={{
            content: (
              <Kb.Button
                fullWidth={true}
                label={this.props.wizard ? 'Continue' : 'Save'}
                onClick={this.onSave}
                disabled={!this.props.image}
              />
            ),
          }}
        >
          <Kb.Box2 direction="vertical" style={styles.wizardContainer} fullHeight={true} gap="small">
            {this.renderImageZoomer()}
            <Kb.Box style={styles.flexReallyGrow} />
            <Kb.Button
              label={this.props.image ? 'Pick a new avatar' : 'Pick an avatar'}
              mode="Secondary"
              onClick={this.props.onChooseNewAvatar}
            />
          </Kb.Box2>
        </Kb.Modal>
      )
    }
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.HeaderHocHeader
          onCancel={this.props.onClose}
          title={C.isIOS ? 'Zoom and pan' : 'Upload avatar'}
        />
        {this.props.error ? (
          <Kb.Banner color="red">
            <Kb.Text type="Body">{this.props.error}</Kb.Text>
          </Kb.Banner>
        ) : null}
        <Kb.Box style={styles.container}>
          <Kb.Box
            style={
              C.isIOS
                ? null
                : Kb.Styles.collapseStyles([
                    styles.zoomContainer,
                    {
                      borderRadius: this.avatar_size(),
                      height: this.avatar_size(),
                      width: this.avatar_size(),
                    },
                  ])
            }
          >
            {this.renderImageZoomer()}
          </Kb.Box>
          <Kb.ButtonBar direction="column">
            <Kb.WaitingButton
              fullWidth={true}
              label="Save"
              onClick={this.onSave}
              style={styles.button}
              waitingKey={this.props.waitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.Box2>
    )
  }
}

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
