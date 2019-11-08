import * as React from 'react'
import * as Types from '../../constants/types/people'
import {Box2, ConnectedNameWithIcon, ScrollView, Text} from '../../common-adapters'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

// import Svg, {
//   Circle,
//   Ellipse,
//   G,
//   TSpan,
//   TextPath,
//   Path,
//   Polygon,
//   Polyline,
//   Line,
//   Rect,
//   Use,
//   Image,
//   Symbol,
//   Defs,
//   LinearGradient,
//   RadialGradient,
//   Stop,
//   ClipPath,
//   Pattern,
//   Mask,
// } from 'react-native-svg';

import * as Svg from 'react-native-svg';

// import { View, StyleSheet } from 'react-native';

export const Savage = (props) => (
  <Kb.Box2 direction="vertical">
    <Kb.Text type="BodySemibold">Unmoving:</Kb.Text>
    <Unmoving/>
    <Kb.Text type="BodySemibold">Moving:</Kb.Text>
    <Moving/>
  </Kb.Box2>
)

const Unmoving = (props) => (
  <Box2 direction="vertical" style={styles.container}>
    <Svg.Svg height="50%" width="50%" viewBox="0 0 100 100">
      <Svg.Circle
        cx="50"
        cy="50"
        r="45"
        stroke="blue"
        strokeWidth="2.5"
        fill="green"
      />
      <Svg.Rect
        x="15"
        y="15"
        width="70"
        height="70"
        stroke="red"
        strokeWidth="2"
        fill="yellow"
      />
    </Svg.Svg>
  </Box2>
)

const Moving = (props) => {
  const [angleTarget, setAngleTarget] = React.useState(0)
  Kb.useInterval(() => setAngleTarget(angleTarget === 0 ? 60 : 0), 500)
  return (<Box2 direction="vertical" style={styles.container}>
    <Kb.Animated to={{angle: angleTarget}}>
      {({ angle }) =>
        <Svg.Svg height="50%" width="50%" viewBox="0 0 100 100">
          <Svg.Circle
            cx="50"
            cy="50"
            r="45"
            stroke="green"
            strokeWidth="5"
            fill="blue"
          />
          <Svg.Rect
            x="15"
            y="15"
            width="70"
            height="70"
            fill="yellow"
            rotation={angle}
          />
        </Svg.Svg>
      }
    </Kb.Animated>
  </Box2>)
}

export default Savage

// export default class SvgExample extends React.Component {
//   render() {
//     return (
//     <Text type="BodySmallSemibold">
//       Consider borrowing...
//     </Text>
//     )
//     return (
//       <View
//         style={[
//           StyleSheet.absoluteFill,
//           { alignItems: 'center', justifyContent: 'center' },
//         ]}
//       >
//         <Svg height="50%" width="50%" viewBox="0 0 100 100">
//           <Circle
//             cx="50"
//             cy="50"
//             r="45"
//             stroke="blue"
//             strokeWidth="2.5"
//             fill="green"
//           />
//           <Rect
//             x="15"
//             y="15"
//             width="70"
//             height="70"
//             stroke="red"
//             strokeWidth="2"
//             fill="yellow"
//           />
//         </Svg>
//       </View>
//     );
//   }
// }

const styles = Styles.styleSheetCreate(() => ({
  container: {
    width: 100,
    height: 100,
  },
}))