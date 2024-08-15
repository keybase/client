import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {type Props} from '.'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {ModalTitle} from '@/teams/common'
import * as Container from '@/util/container'

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
        if (!result.canceled && result.assets.length > 0) {
          setSelectedImage(result.assets[0])
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

class AvatarUpload extends React.Component<Props & WrappedProps> {
  _h: number = 0
  _w: number = 0
  _x: number = 0
  _y: number = 0
  _z: boolean = false

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
    let crop: undefined | ReturnType<typeof this._getCropCoordinates>
    // Only set the cropping coordinates if they’ve zoomed the image.
    if (this._z) {
      crop = this._getCropCoordinates()
    }
    this.props.onSave(this.props.image.uri, crop)
  }

  _getCropCoordinates = () => {
    let height: number | undefined
    let width: number | undefined
    if (this.props.image) {
      height = this.props.image.height
      width = this.props.image.width
    }

    const x = this._x
    const y = this._y
    const rH = this._h !== 0 && height ? height / this._h : 1
    const rW = this._w !== 0 && width ? width / this._w : 1
    const x0 = rW * x
    const y0 = rH * y
    return {
      x0: Math.round(x0),
      x1: Math.round((x + this.avatar_size()) * rW),
      y0: Math.round(y0),
      y1: Math.round((y + this.avatar_size()) * rH),
    }
  }

  _onZoom = ({height, width, x, y}: {height: number; width: number; x: number; y: number}) => {
    this._h = height
    this._w = width
    this._x = x
    this._y = y
    this._z = true
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

    return {
      height,
      width,
    }
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
    return uri ? (
      <Kb.ZoomableImage
        src={uri}
        onChanged={this._onZoom}
        // using collapse doesn't work somehow, using devtools it loses the height on android only
        style={{...styles.image, ...this.getImageStyle()}}
        boxCacheKey="avatar"
      />
    ) : null
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
