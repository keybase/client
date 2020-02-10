import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'

type Props = {
  username: string
}

const Circle = (p: Props) => {
  const {username} = p
  if (!username) return null

  return (
    <Kb.Svg.Svg height={100} width={100} viewBox="0 0 100 100">
      <Kb.Svg.Circle cx="50" cy="50" r="45" stroke="blue" strokeWidth="2.5" fill="green" />
    </Kb.Svg.Svg>
  )
}

export default Circle
