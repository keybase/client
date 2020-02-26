import * as React from 'react'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import Text from '../../common-adapters/text'
import {useGetIDInfo} from './hooks'
import {useInterval} from '../../common-adapters/use-timers'
/** @jsx jsx */
import {jsx, css} from '@emotion/core'

const Kb = {
  Text,
}

type Props = {
  username: string
  size: number
}

//const HalfCircle = ({size, style}) => (
//<div
//style={Styles.collapseStyles([
//style,
//{width: size, height: size / 2, borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2},
//])}
///>
//)

const Circle = (p: Props) => {
  const {username, size} = p

  //const {running, load, percentDone, color} = useGetIDInfo(username)
  // TEMP
  const [percentDone, setPercentDone] = React.useState(0)

  useInterval(() => {
    setPercentDone(p => {
      let next = p + 0.1
      if (next >= 1) {
        next = 0
      }
      return next
    })
  }, 1000)

  const color = 'green'

  const backgroundColor = 'white'

  if (!username) {
    return null
  }

  const oneColor = color
  const twoColor = backgroundColor
  const threeColor = backgroundColor

  const oneTransform = ''
  const twoTransform = `rotate(${percentDone}turn)`
  const threeTransform = 'rotate(0.5turn)'

  const width = 6
  const styleSize = size + width * 2

  const common = {
    borderTopLeftRadius: styleSize / 2,
    borderTopRightRadius: styleSize / 2,
    height: styleSize / 2,
    marginLeft: -width,
    marginTop: -width,
    position: 'absolute',
    transformOrigin: 'bottom center',
    width: styleSize,
    zIndex: 1000,
  } as const

  // overlapping borderradius things fringes on the edges
  const coverStyle = {
    ...common,
    backgroundColor: twoColor,
  }
  const extra = 2
  coverStyle.width += extra * 2
  coverStyle.marginLeft -= extra
  coverStyle.marginTop -= extra
  coverStyle.height += extra

  //<Kb.Text type="Body" style={{position: 'absolute'}}>
  //{JSON.stringify(
  //{
  ////color,
  ////load,
  //percentDone,
  ////running,
  //},
  //null,
  //4
  //)}
  //</Kb.Text>
  return (
    <>
      <div key="one" style={{...common, backgroundColor: oneColor, transform: oneTransform}} />
      <div
        key="two"
        style={coverStyle}
        css={css`
          transition-duration: 1s;
          transition-property: transform;
          transform: ${twoTransform};
        `}
      />
      <div key="three" style={{...common, backgroundColor: threeColor, transform: threeTransform}} />
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
  //return (
  //<Kb.Svg.Svg
  //height={size}
  //width={size}
  //viewBox={`0 0 ${size} ${size}`}
  //style={styles.container}
  //></Kb.Svg.Svg>
  //)
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    position: 'absolute',
  },
}))

export default Circle
