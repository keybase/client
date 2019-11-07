import * as React from 'react'
import * as Types from '../../constants/types/people'
import {Box2, ConnectedNameWithIcon, ScrollView, Text} from '../../common-adapters'
import * as Styles from '../../styles'

import Svg, {
  Circle,
  Ellipse,
  G,
  TSpan,
  TextPath,
  Path,
  Polygon,
  Polyline,
  Line,
  Rect,
  Use,
  Image,
  Symbol,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  ClipPath,
  Pattern,
  Mask,
} from 'react-native-svg';

// import { View, StyleSheet } from 'react-native';

export const Savage = (props) => (
  <Box2 direction="vertical">
    <Svg height="50%" width="50%" viewBox="0 0 100 100">
      <Circle
        cx="50"
        cy="50"
        r="45"
        stroke="blue"
        strokeWidth="2.5"
        fill="green"
      />
      <Rect
        x="15"
        y="15"
        width="70"
        height="70"
        stroke="red"
        strokeWidth="2"
        fill="yellow"
      />
    </Svg>
  </Box2>
)

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