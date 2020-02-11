import * as React from 'react'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {useGetIDInfo} from './hooks'

type Props = {
  username: string
  size: number
}

const HalfCircle = ({size, style}) => (
  <div
    style={Styles.collapseStyles([
      style,
      {width: size, height: size / 2, borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2},
    ])}
  />
)

const Circle = (p: Props) => {
  const {username, size} = p

  const {running, load, percentDone, color} = useGetIDInfo(username)

  if (!username) {
    return null
  }

  return (
    <>
      <Kb.Text type="Body" style={{position: 'absolute'}}>
        {JSON.stringify(
          {
            color,
            load,
            percentDone,
            running,
          },
          null,
          4
        )}
      </Kb.Text>
      <HalfCircle size={size} style={{position: 'absolute', backgroundColor: color}} />
    </>
  )

  // const half = size / 2
  // const stroke = 4
  // const halfStroke = stroke / 2

  // <Kb.Svg.Circle
  // cx={half}
  // cy={half}
  // r={half - halfStroke}
  // stroke="blue"
  // strokeWidth={stroke}
  // fill="transparent"
  // />
  // d={`
  // M ${half} ${half}
  // m -${half}, 0
  // a ${half},${half} 0 1,0 (${size}),0
  // a ${half},${half} 0 1,0 -(${size}),0
  // `}
  // <Kb.Svg.Path
  // d={`M ${size}, ${size}
  // m -${size},-${half}
  // a ${half},${half} 0 1,0 ${size},0
  // a ${half},${half} 0 1,0 -${size},0
  // `}
  // stroke="blue"
  // strokeWidth={stroke}
  // fill="green"
  // />
  // <Kb.Svg.Circle
  // cx={half}
  // cy={half}
  // r={half - halfStroke}
  // strokeDasharray="30.81, 100"
  // strokeDashoffset="0"
  // strokeWidth={stroke}
  // fill="green"
  // />
  // <Kb.Svg.G strokeWidth="11.25">
  // <Kb.Svg.Circle
  // cx={half}
  // cy={half}
  // r={half}
  // strokeDasharray="30.851 100"
  // strokeDashoffset="0"
  // stroke="red"
  // ></Kb.Svg.Circle>
  // <Kb.Svg.Circle
  // cx={half}
  // cy={half}
  // r={half}
  // strokeDasharray="5.330 100"
  // strokeDashoffset="-30.851"
  // stroke="green"
  // ></Kb.Svg.Circle>
  // <Kb.Svg.Circle
  // cx={half}
  // cy={half}
  // r={half}
  // strokeDasharray="63.819 100"
  // strokeDashoffset="-36.181"
  // stroke="blue"
  // ></Kb.Svg.Circle>
  // </Kb.Svg.G>
  return (
    <Kb.Svg.Svg
      height={size}
      width={size}
      viewBox={`0 0 ${size} ${size}`}
      style={styles.container}
    ></Kb.Svg.Svg>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    position: 'absolute',
  },
}))

export default Circle
