import * as React from 'react'
import Box from './box'
import LottieView from 'lottie-react-native'
import type {Props, AnimationType} from './animation'
import {useDepChangeEffect} from '../util/container'
type AnimationObject = {
  v: string
  fr: number
  ip: number
  op: number
  w: number
  h: number
  nm: string
  ddd: number
  assets: any[]
  layers: any[]
}
type AOM = {[key in AnimationType]: AnimationObject}

const Animation = React.memo(function Animation(props: Props) {
  const {animationType} = props
  const dataRef = React.useRef<AOM>(require('./animation-data.json'))
  const source = React.useRef<AnimationObject>(dataRef.current[animationType])
  useDepChangeEffect(() => {
    const data = dataRef.current[animationType]
    source.current = data
  }, [animationType])

  return (
    <Box style={props.containerStyle}>
      <LottieView autoPlay={true} loop={true} source={source.current} style={props.style ?? noStyle} />
    </Box>
  )
})

const noStyle = {flexGrow: 1, flexShrink: 1}

export default Animation
