import * as React from 'react'
import Toast from './toast.desktop'
import {Box2} from './box'
import Text from './text.desktop'
import type {Props} from './zoomable-image'
import type {MeasureRef} from './measure-ref'

const Kb = {
  Box2,
  Text,
  Toast,
}

const ZoomableImage = React.memo(function ZoomableImage(p: Props) {
  const {src, onIsZoomed, onLoaded, dragPan, onChanged, onError, forceDims} = p
  const [isZoomed, setIsZoomed] = React.useState(false)
  const [allowPan, setAllowPan] = React.useState(true)
  const [showToast, setShowToast] = React.useState(false)
  const containerRef = React.useRef<MeasureRef | null>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const scaleRef = React.useRef(1)
  const isZoomedRef = React.useRef(isZoomed)

  const toggleZoom = React.useCallback(() => {
    isZoomedRef.current = !isZoomed
    setIsZoomed(s => !s)
    // hide until we handle mouse move
    imgRef.current?.classList.remove('fade-anim-enter-active')
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !imgRef.current) return

    if (dragPan && !allowPan) return

    imgRef.current.classList.add('fade-anim-enter-active')

    if (!dragPan && !isZoomedRef.current) {
      imgRef.current.style.transform = ''
      return
    }

    const containerRect = containerRef.current.measure?.()
    if (!containerRect) return

    const imgRect = imgRef.current.getBoundingClientRect()
    const xPercent = Math.min(1, Math.max(0, (e.clientX - containerRect.left) / containerRect.width))
    const yPercent = Math.min(1, Math.max(0, (e.clientY - containerRect.top) / containerRect.height))

    const x = Math.min(
      // if the image is smaller then center it
      imgRect.width < containerRect.width ? (containerRect.width - imgRect.width) / 2 : 0,
      Math.max(
        -(imgRect.width - containerRect.width),
        containerRect.width * xPercent - imgRect.width * xPercent
      )
    )
    const y = Math.min(
      imgRect.height < containerRect.height ? (containerRect.height - imgRect.height) / 2 : 0,
      Math.max(
        -(imgRect.height - containerRect.height),
        containerRect.height * yPercent - imgRect.height * yPercent
      )
    )

    imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`
    onChanged?.({height: imgRect.height, scale: scaleRef.current, width: imgRect.width, x: -x, y: -y})
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.cancelable && e.preventDefault()

    if (dragPan && !allowPan) return
    if (!dragPan && !isZoomedRef.current) return

    const delta = e.deltaY > 0 ? 1.02 : 0.98
    scaleRef.current = Math.min(2.5, Math.max(0.3, scaleRef.current * delta))
    handleMouseMove(e)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (dragPan) {
      setAllowPan(p => !p)
    } else {
      toggleZoom()
      setTimeout(() => {
        handleMouseMove(e)
      }, 0)
    }
  }

  let style: React.CSSProperties = {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  }
  let imgStyle: React.CSSProperties = {
    display: 'flex',
    position: 'absolute',
    transformOrigin: '0 0',
  }
  if (dragPan) {
    style = {...style, cursor: allowPan ? 'move' : 'pointer'}
  } else {
    style = {
      ...style,
      cursor: isZoomed ? 'zoom-out' : 'zoom-in',
      ...(isZoomed ? {} : {display: 'flex'}),
    }
    imgStyle = isZoomed
      ? {
          ...imgStyle,
        }
      : {
          ...forceDims,
          margin: 'auto',
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
        }
  }

  const divRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    containerRef.current = {
      divRef,
      measure: () => {
        return divRef.current?.getBoundingClientRect()
      },
    }
  }, [])

  return (
    <div ref={divRef} style={style} onMouseMove={handleMouseMove} onWheel={handleWheel} onClick={handleClick}>
      <img
        draggable={false}
        onLoad={onLoaded}
        onError={onError}
        className="fade-anim-enter fade-anim-enter-active"
        ref={imgRef}
        src={src}
        style={imgStyle}
      />
      <Kb.Toast visible={showToast} attachTo={containerRef}>
        <Kb.Text type="Body" negative={true}>
          Scroll to zoom. Move to pan
        </Kb.Text>
      </Kb.Toast>
    </div>
  )
})

export default ZoomableImage
