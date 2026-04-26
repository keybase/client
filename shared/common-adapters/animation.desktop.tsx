import * as React from 'react'
import {Box2} from './box'
import lottie from 'lottie-web'
import type {Props, AnimationType} from './animation'

const defaultDimension = 16

function Animation(props: Props) {
  const {style, width, height, animationType, className, containerStyle} = props
  const elementRef = React.useRef<HTMLDivElement>(null)
  const lottieInstance = React.useRef<null | ReturnType<typeof lottie.loadAnimation>>(null)

  const data = React.useRef(require('./animation-data.json') as {[key in AnimationType]: unknown})
  React.useEffect(() => {
    if (elementRef.current) {
      const animationData = data.current[animationType]
      lottieInstance.current?.destroy()
      lottieInstance.current = lottie.loadAnimation({
        animationData,
        container: elementRef.current,
      })
    }
    return () => {
      lottieInstance.current?.destroy()
      lottieInstance.current = null
    }
  }, [animationType])
  return (
    <Box2
      direction="vertical"
      {...(className === undefined ? {} : {className})}
      {...(containerStyle === undefined ? {} : {style: containerStyle})}
    >
      <div
        style={
          {
            height: height ?? defaultDimension,
            width: width ?? defaultDimension,
            ...style,
          } as React.CSSProperties
        }
        ref={elementRef}
      />
    </Box2>
  )
}

export default Animation
