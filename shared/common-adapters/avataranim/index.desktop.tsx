import * as React from 'react'
import * as Styles from '../../styles'
import {Box2, Box} from '../box'
import Text from '../text'
import Animated from '../animated'
import {useTimeout, useInterval} from '../use-timers'
import { Props } from '.'

const Kb = {
  Box,
  Box2,
  Text,
  Animated,
  useInterval,
}

const AvatarAnim = (props: Props): React.ReactElement => {
  const [angleTarget, setAngleTarget] = React.useState(0)
  const avatarSizeClasName = `avatar-user-size-${props.size}`
  Kb.useInterval(() => setAngleTarget(angleTarget === 0 ? 60 : 0), 1000)
  return (<Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.abs, {width: props.size, height: props.size}])}>
      <Kb.Animated to={{angle: angleTarget}}>
        {({ angle }) =>
          <svg height="100%" width="100%" viewBox="-1 -1 2 2">
            <circle
              cx="0"
              cy="0"
              r="1"
              stroke="green"
              strokeWidth=".05"
              fill="blue"
            />
            <rect
              x="0"
              y="0"
              width=".2"
              height=".2"
              fill="yellow"
              transform={`rotate(${angle})`}
            />
          </svg>
        }
      </Kb.Animated>
    </Kb.Box2>
    <div
      style={Styles.collapseStyles([styles.abs, { backgroundImage: props.url, width: props.size, height: props.size, borderRadius: props.size/2, opacity: .7 }])}
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
