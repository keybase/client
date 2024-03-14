import * as React from 'react'
import Box from './box'
import lottie from 'lottie-web'
import type {Props, AnimationType} from './animation'
import type {default as AnimationData} from './animation-data.json'

const defaultDimension = 16
const _typeToData = new Map<AnimationType, unknown>()

const useAnimationData = (type: AnimationType) => {
  const existing = _typeToData.get(type)
  if (existing) {
    return existing
  }
  const animationData = require('./animation-data.json') as typeof AnimationData

  const options = animationData[type]
  _typeToData.set(type, options)
  return options
}

const Animation = React.memo(function Animation(props: Props) {
  const {style, width, height, animationType} = props
  const [element, setElement] = React.useState<HTMLDivElement | null>(null)
  const lottieInstance = React.useRef<null | ReturnType<typeof lottie.loadAnimation>>(null)
  const animationData = useAnimationData(animationType)
  React.useEffect(() => {
    if (element) {
      lottieInstance.current?.destroy()
      lottieInstance.current = lottie.loadAnimation({
        animationData,
        container: element,
      })
    }
    return () => {
      lottieInstance.current?.destroy()
      lottieInstance.current = null
    }
  }, [animationData, element])
  return (
    <Box className={props.className} style={props.containerStyle}>
      <div
        style={
          {
            height: height ?? defaultDimension,
            width: width ?? defaultDimension,
            ...style,
          } as React.CSSProperties
        }
        ref={setElement}
      />
    </Box>
  )
})

export default Animation
