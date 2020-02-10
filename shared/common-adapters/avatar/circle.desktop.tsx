import * as React from 'react'
import * as Container from '../../util/container'
import * as SVG from 'react-native-svg/lib/commonjs/ReactNativeSVG.web'

type Props = {
  username: string
}

const Circle = (p: Props) => {
  const {username} = p
  if (!username) return null

  return (
    <SVG.Svg height={100} width={100} viewBox="0 0 100 100">
      <SVG.Circle cx="50" cy="50" r="45" stroke="blue" strokeWidth="2.5" fill="green" />
    </SVG.Svg>
  )
}

export default Circle
