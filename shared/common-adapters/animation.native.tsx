import * as React from 'react'
import LottieView from 'lottie-react-native'
import Box from './box'
import {useDepChangeEffect} from '../util/container'
import type {Props} from './animation'
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
type AOM = {[key: string]: AnimationObject}

const Animation = React.memo(function Animation(props: Props) {
  const {animationType} = props
  const dataRef = React.useRef<AOM>()
  if (!dataRef.current) {
    dataRef.current = require('./animation-data.json') as AOM
  }

  const source = React.useRef<AnimationObject>(dataRef.current[animationType])
  useDepChangeEffect(() => {
    const data = dataRef.current?.[animationType]
    // never happens
    if (!data) {
      return
    }
    source.current = data
  }, [animationType])

  return (
    <Box style={props.containerStyle}>
      <LottieView autoPlay={true} loop={true} source={source.current} style={props.style} />
    </Box>
  )
})

export default Animation
