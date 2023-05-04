import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import Toast from './toast.desktop'
import Text from './text.desktop'
import type {Props} from './zoomable-image'
import clamp from 'lodash/clamp'

const Kb = {
  Text,
  Toast,
}

const onDragStart = (e: React.BaseSyntheticEvent) => e.preventDefault()
const ZoomableImage = React.memo(function ZoomableImage(p: Props) {
  const {src, onIsZoomed, style, onLoaded, dragPan, onChanged} = p
  const [isZoomed, setIsZoomed] = React.useState(false)
  const [allowPan, setAllowPan] = React.useState(true)
  const [imgSize, setImgSize] = React.useState({height: 0, width: 0})
  const isMounted = Container.useIsMounted()
  const [lastSrc, setLastSrc] = React.useState('')
  // const isDragging = React.useRef(false)

  if (lastSrc !== src) {
    setLastSrc(src)
    const img = new Image()
    img.src = src
    img.onload = () => {
      isMounted() && setImgSize({height: img.naturalHeight, width: img.naturalWidth})
    }
  }

  const onImageMouseLeave = React.useCallback(() => {
    const target = document.getElementById('imgAttach')
    if (!target) return
    target.style.transform = ''
  }, [])

  const initialZoomRatio = 1.2
  const [zoomRatio, setZoomRatio] = React.useState(p.zoomRatio ?? initialZoomRatio)
  // const [lastIncomingZoom, setLastIncomingZoom] = React.useState(p.zoomRatio)
  // if (lastIncomingZoom !== p.zoomRatio) {
  //   setLastIncomingZoom(p.zoomRatio)
  //   if (p.zoomRatio) {
  //     setZoomRatio(p.zoomRatio)
  //   }
  // }

  const toggleAllowPan = () => {
    setAllowPan(s => !s)
  }

  const toggleZoom = React.useCallback(() => {
    setIsZoomed(s => !s)
    onIsZoomed?.(!isZoomed)
    setZoomRatio(initialZoomRatio)
  }, [isZoomed, onIsZoomed])

  const [lastIsZoomed, setLastIsZoomed] = React.useState(isZoomed)
  if (lastIsZoomed !== isZoomed) {
    setLastIsZoomed(isZoomed)
    if (!isZoomed) {
      onImageMouseLeave()
    }
  }

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
    const zoomRatio = 7 // TEMP
    // const zoomRatio = 1 / 0.3669724770642202 // TEMP
    const e = lastEvent.current
    const parent = document.getElementById('scrollAttach')
    const img = document.getElementById('imgAttach')
    if (!parent || !img) {
      return
    }
    if (!isZoomed && !dragPan) {
      img.style.transform = ''
      return
    }

    if (!e) return

    const rect = parent.getBoundingClientRect()
    // position in parent
    const x = clamp(Math.round(e.clientX - rect.left), 0, rect.width - 1) //rect.width / 2
    const y = clamp(Math.round(e.clientY - rect.top), 0, rect.height - 1) //rect.height / 2

    console.log('bbb', x, e?.clientX, rect.left)

    // ratio in parent
    let xr = x / (rect.width - 1)
    let yr = y / (rect.height - 1)

    // xr = 1 // TEMP
    // yr = 1 // TEMP

    console.log('eee', xr, x, rect.width)

    // image size
    const iw = imgSize.width
    const ih = imgSize.height

    // offset to center ourselves in parent after scaling
    const centerX = rect.width / 2 - (iw * zoomRatio) / 2
    const centerY = rect.height / 2 - (ih * zoomRatio) / 2

    // moving the mouse should translate you to the edges of the image
    const mouseX = centerX + (1 - xr) * 2 * -centerX
    const mouseY = centerY + (1 - yr) * 2 * -centerY

    console.log('ddd', mouseX, mouseY)

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

    if (onChanged) {
      const width = iw * zoomRatio
      const height = ih * zoomRatio
      // const xr = 1 // TEMP
      // const yr = 0 // TEMP
      // const _x = xr * (iw * zoomRatio - rect.width * zoomRatio)
      // const _y = yr * (ih * zoomRatio - rect.height * zoomRatio)
      // const _x = xr * iw * zoomRatio - rect.width * zoomRatio
      // const _y = yr * ih * zoomRatio - rect.height * zoomRatio
      // x0pixels should be: 2400 (pixels) - 300 (zoomed pixels) = 2100
      // x1pixels should be: 2100 (x0pixels) + 300 (zoomed pixels) = 2400

      //zoom * imagew - rect.width/zoom
      // const _x = xr * width - (xr * rect.width) / zoomRatio
      // x1pixels = x0pixels +rect.width/zoom
      // const _y = yr * height - (yr * rect.height) / zoomRatio

      let _x = xr * (width - rect.width / zoomRatio)
      let _y = yr * (height - rect.height / zoomRatio)

      const temp = {height, scale: zoomRatio, width, x: _x, y: _y}
      console.log('aaa2', {x: temp.x, x1: _x + rect.width / zoomRatio})
      onChanged(temp)
    }
  }, [zoomRatio, imgSize, isZoomed, dragPan, onChanged])

  const [lastZoomRatio, setLastZoomRatio] = React.useState(0)
  if (lastZoomRatio !== zoomRatio || isZoomed !== lastIsZoomed) {
    setLastZoomRatio(zoomRatio)
    setLastIsZoomed(isZoomed)
    adjustImageStyle()
  }

  const onImageMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragPan && !allowPan) {
        return
      }
      lastEvent.current = e
      adjustImageStyle()
    },
    [adjustImageStyle, dragPan, allowPan]
  )

  const attachTo = React.useCallback(() => {
    return toastAnchorRef.current
  }, [toastAnchorRef])

  // const onMouseDown = React.useCallback(() => {
  //   isDragging.current = true
  // }, [])
  // const onMouseUp = React.useCallback(() => {
  //   isDragging.current = false
  // }, [])

  return (
    <div
      id="scrollAttach"
      onClick={dragPan ? toggleAllowPan : toggleZoom}
      // onMouseDown={dragPan ? onMouseDown : undefined}
      // onMouseUp={dragPan ? onMouseUp : undefined}
      ref={toastAnchorRef}
      style={Styles.collapseStyles([
        isZoomed ? styles.scrollAttachZoomed : (styles.scrollAttachOrig as any),
        style,
      ])}
      onMouseMove={onImageMouseMove}
      onMouseLeave={isZoomed ? onImageMouseLeave : undefined}
      onWheel={isZoomed || dragPan ? onImageWheel : undefined}
    >
      <img
        id="imgAttach"
        src={src}
        style={isZoomed || dragPan ? styles.imgZoomed : (styles.imgOrig as any)}
        onLoad={onLoaded}
        onDragStart={onDragStart}
      />
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
          left: 0,
          position: 'absolute',
          top: 0,
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
