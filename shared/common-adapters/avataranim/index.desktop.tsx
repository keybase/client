import * as React from 'react'
import * as Styles from '../../styles'
import {Box2, Box} from '../box'
import Text from '../text'
import Animated, {animated} from '../animated'
import {useTimeout, useInterval} from '../use-timers'
import { Props } from '.'
import * as Svg from 'react-native-svg';

const Kb = {
  Box,
  Box2,
  Text,
  Animated,
  useInterval,
}

const AvatarAnim = (props: Props): React.ReactElement => {
  const buffer = props.size/16; // padding from the bounds of the avatar to the edge of the svg
  const svg_dim = { width: props.size + buffer * 2, height: props.size + buffer * 2 }
  const [angleTarget, setAngleTarget] = React.useState(0)
  const avatarSizeClasName = `avatar-user-size-${props.size}`
  Kb.useInterval(() => setAngleTarget(angleTarget === 0 ? 60 : 0), 1000)
  return (<Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.container, {width: props.size, height: props.size}])}>
    <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.abs, {width: svg_dim.width, height: svg_dim.height, top: -buffer, left: -buffer}])}>
      <Kb.Animated to={{angle: angleTarget}}>
        {({ angle }) =>
          <Svg.Svg height="100%" width="100%" viewBox={`${-svg_dim.width/2} ${-svg_dim.height/2} ${svg_dim.width} ${svg_dim.height}`}>
            <Svg.Circle
              cx="0"
              cy="0"
              r={props.size/2}
              stroke={Styles.globalColors.green}
              strokeWidth="6"
              strokeDasharray="30, 8"
              // rotation={angle}
              // transform={`rotate(${angle})`}
            />
          </Svg.Svg>
        }
      </Kb.Animated>
    </Kb.Box2>
    <div
      className="avatar-user-image"
      style={Styles.collapseStyles([styles.abs, { backgroundImage: props.url, width: props.size, height: props.size, borderRadius: props.size/2 }])}
    />
  </Kb.Box2>)
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    position: 'relative',
  },
  abs: {
    position: 'absolute',
    top: 0,
    left: 0,
  }
}))

export default AvatarAnim
