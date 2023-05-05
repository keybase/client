import * as React from 'react'
import Toast from './toast.desktop'
import Text from './text.desktop'
import type {Props} from './zoomable-image'

const Kb = {
  Text,
  Toast,
}

const ZoomableImage = React.memo(function ZoomableImage(p: Props) {
  const {src, onIsZoomed, onLoaded, dragPan, onChanged} = p
  const [isZoomed, setIsZoomed] = React.useState(false)
  const [allowPan, setAllowPan] = React.useState(true)
  const [showToast, setShowToast] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const scaleRef = React.useRef(1)
  const isZoomedRef = React.useRef(isZoomed)

  const toggleZoom = React.useCallback(() => {
    isZoomedRef.current = !isZoomed
    setIsZoomed(s => !s)
    onIsZoomed?.(!isZoomed)
  }, [isZoomed, onIsZoomed])

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

  const attachTo = React.useCallback(() => {
    return containerRef.current
  }, [containerRef])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !imgRef.current) return

    if (dragPan && !allowPan) return
    if (!dragPan && !isZoomedRef.current) {
      imgRef.current.style.transform = ''
      return
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const imgRect = imgRef.current.getBoundingClientRect()
    const xPercent = (e.clientX - containerRect.left) / containerRect.width
    const yPercent = (e.clientY - containerRect.top) / containerRect.height

    const x = Math.min(
      0,
      Math.max(
        -(imgRect.width - containerRect.width),
        containerRect.width * xPercent - imgRect.width * xPercent
      )
    )
    const y = Math.min(
      0,
      Math.max(
        -(imgRect.height - containerRect.height),
        containerRect.height * yPercent - imgRect.height * yPercent
      )
    )

    imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`
    onChanged?.({x: -x, y: -y, width: imgRect.width, height: imgRect.height, scale: scaleRef.current})
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()

    if (dragPan && !allowPan) return
    if (!dragPan && !isZoomedRef.current) return

    const delta = e.deltaY > 0 ? 1.1 : 0.9
    scaleRef.current = Math.max(1, scaleRef.current * delta)
    handleMouseMove(e)
  }

  const handleClick = e => {
    if (dragPan) {
      setAllowPan(p => !p)
    } else {
      toggleZoom()
      handleMouseMove(e)
    }
  }

  let style: any = {
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  }
  let imgStyle: any = {display: 'flex', position: 'absolute', transformOrigin: '0 0', opacity: src ? 1 : 0}
  if (dragPan) {
    style = {...style, cursor: allowPan ? 'move' : 'pointer'}
  } else {
    style = {
      ...style,
      cursor: isZoomed ? 'zoom-out' : 'zoom-in',
      ...(isZoomed ? {} : {display: 'flex'}),
    }
    imgStyle = isZoomed ? undefined : {maxWidth: '100%', maxHeight: '100%', margin: 'auto'}
  }

  return (
    <div
      ref={containerRef}
      style={style}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <img onLoad={onLoaded} ref={imgRef} src={src} style={imgStyle} />
      <Kb.Toast visible={showToast} attachTo={attachTo}>
        <Kb.Text type="Body" negative={true}>
          Scroll to zoom. Move to pan
        </Kb.Text>
      </Kb.Toast>
    </div>
  )
})

export default ZoomableImage
