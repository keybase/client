import * as React from 'react'
import Box from './box'
import lottie from 'lottie-web'
import type {Props, AnimationType} from './animation'

const defaultDimension = 16
const _typeToData = new Map<AnimationType, unknown>()

const useAnimationData = (type: AnimationType) => {
  const existing = _typeToData.get(type)
  if (existing) {
    return existing
  }
  const animationData = require('./animation-data.json')

  const options = animationData[type]
  _typeToData.set(type, options)
  return options
}

const Animation = React.memo(function Animation(props: Props) {
  const {style, width, height, animationType} = props
  const element = React.useRef<HTMLDivElement>(null)
  const lottieInstance = React.useRef<any>()
  const animationData = useAnimationData(animationType)
  React.useEffect(() => {
    if (element.current) {
      lottieInstance.current?.destroy()
      lottieInstance.current = lottie.loadAnimation({
        animationData,
        container: element.current,
      })
    }
    return () => {
      lottieInstance.current?.destroy()
      lottieInstance.current = null
    }
  }, [animationData])
  return (
    <Box className={props.className} style={props.containerStyle}>
      <div
        // @ts-ignore
        style={{height: height ?? defaultDimension, width: width ?? defaultDimension, ...style}}
        ref={element}
      />
    </Box>
  )
})

export default Animation
