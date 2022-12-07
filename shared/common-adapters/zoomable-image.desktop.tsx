import * as React from 'react'
import * as Styles from '../styles'
import Toast from './toast.desktop'
import Text from './text.desktop'

const Kb = {
  Text,
  Toast,
}

type Props = {
  src: string
  onZoomed?: (z: boolean) => void
  style?: Styles.StylesCrossPlatform
}

const ZoomableImage = React.memo(function ZoomableImage(p: Props) {
  const {src, onZoomed, style} = p
  const [isZoomed, setIsZoomed] = React.useState(false)
  const [imgSize, setImgSize] = React.useState({height: 0, width: 0})

  const isMountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  React.useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      isMountedRef.current && setImgSize({height: img.naturalHeight, width: img.naturalWidth})
    }
  }, [src])

  const onImageMouseLeave = React.useCallback(() => {
    const target = document.getElementById('imgAttach')
    if (!target) return
    target.style.transform = ''
  }, [])

  const initialZoomRatio = 1.2
  const [zoomRatio, setZoomRatio] = React.useState(initialZoomRatio)

  const toggleZoom = React.useCallback(() => {
    setIsZoomed(s => !s)
    onZoomed?.(!isZoomed)
    setZoomRatio(initialZoomRatio)
  }, [isZoomed, onZoomed])

  React.useEffect(() => {
    !isZoomed && onImageMouseLeave()
  }, [onImageMouseLeave, isZoomed])

  const toastAnchorRef = React.useRef(null)
  const [showToast, setShowToast] = React.useState(false)
  React.useEffect(() => {
    if (isZoomed) {
      setShowToast(true)
      const id = setTimeout(() => {
        setShowToast(false)
      }, 3000)
      return () => {
        setShowToast(false)
        clearTimeout(id)
      }
    } else return undefined
  }, [isZoomed])

  const onImageWheel = React.useCallback(e => {
    setZoomRatio(z => {
      const diff = e.deltaY > 0 ? 0.07 : -0.07
      const next = Math.max(0.1, Math.min(z + diff, 20))
      return next
    })
  }, [])

  const lastEvent = React.useRef<React.MouseEvent<HTMLDivElement> | undefined>()

  const adjustImageStyle = React.useCallback(() => {
    const e = lastEvent.current
    const parent = document.getElementById('scrollAttach')
    const img = document.getElementById('imgAttach')
    if (!e || !parent || !img) {
      return
    }
    if (!isZoomed) {
      img.style.transform = ''
      return
    }

    const rect = parent.getBoundingClientRect()
    // position in parent
    const x = Math.max(0, e.clientX - rect.left)
    const y = Math.max(0, e.clientY - rect.top)
    // ratio in parent
    const xr = x / rect.width
    const yr = y / rect.height
    // image size
    const iw = imgSize.width
    const ih = imgSize.height

    // offset to center ourselves in parent after scaling
    const centerX = rect.width / 2 - (iw * zoomRatio) / 2
    const centerY = rect.height / 2 - (ih * zoomRatio) / 2

    // moving the mouse should translate you to the edges of the image
    const mouseX = centerX + (1 - xr) * 2 * -centerX
    const mouseY = centerY + (1 - yr) * 2 * -centerY

    const temp = [
      // move to middle
      `translate(${-0.5 * iw}px, ${-0.5 * ih}px)`,
      // scale up
      `scale(${zoomRatio})`,
      // move to top left
      `translate(${0.5 * iw * zoomRatio}px, ${0.5 * ih * zoomRatio}px)`,
      // center in parent. you go half the parent rect (img top in center, then go back so your center is center)
      `translate(${centerX}px, ${centerY}px)`,
      // move based on mouse
      `translate(${mouseX}px, ${mouseY}px)`,
    ]
      .reverse() // applied right to left
      .join(' ')
    img.style.transform = temp
  }, [zoomRatio, imgSize, isZoomed])

  React.useEffect(() => {
    adjustImageStyle()
  }, [adjustImageStyle, zoomRatio, isZoomed])

  const onImageMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      lastEvent.current = e
      adjustImageStyle()
    },
    [adjustImageStyle]
  )

  const attachTo = React.useCallback(() => {
    return toastAnchorRef.current
  }, [toastAnchorRef])

  return (
    <div
      id="scrollAttach"
      onClick={toggleZoom}
      ref={toastAnchorRef}
      style={Styles.collapseStyles([
        isZoomed ? styles.scrollAttachZoomed : (styles.scrollAttachOrig as any),
        style,
      ])}
      onMouseMove={onImageMouseMove}
      onMouseLeave={isZoomed ? onImageMouseLeave : undefined}
      onWheel={isZoomed ? onImageWheel : undefined}
    >
      <img id="imgAttach" src={src} style={isZoomed ? styles.imgZoomed : (styles.imgOrig as any)} />
      <Kb.Toast visible={showToast} attachTo={attachTo}>
        <Kb.Text type="Body" negative={true}>
          Scroll to zoom. Move to pan
        </Kb.Text>
      </Kb.Toast>
    </div>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      imgOrig: Styles.platformStyles({
        isElectron: {
          display: 'flex',
          margin: 'auto',
          maxHeight: '100%',
          maxWidth: '100%',
          transform: '',
        },
      }),
      imgZoomed: Styles.platformStyles({
        isElectron: {
          position: 'absolute',
          transformOrigin: 'top left',
        },
      }),
      scrollAttachOrig: Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          cursor: 'zoom-in',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        },
      }),
      scrollAttachZoomed: Styles.platformStyles({
        isElectron: {
          cursor: 'zoom-out',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        },
      }),
    } as const)
)

export default ZoomableImage
