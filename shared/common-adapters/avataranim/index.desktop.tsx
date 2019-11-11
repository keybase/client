import * as React from 'react'
import * as Styles from '../../styles'
import {Box2, Box} from '../box'
import Text from '../text'
import Animated from '../animated'
import {useTimeout, useInterval} from '../use-timers'
import {NativeImage} from '../native-wrappers.native'
import { Props } from '.'

const Kb = {
  Box,
  Box2,
  Text,
  Animated,
  NativeImage,
  useInterval,
}

const AvatarAnim = (props: Props): React.ReactElement => {
  const size = 192
  const [angleTarget, setAngleTarget] = React.useState(0)
  Kb.useInterval(() => setAngleTarget(angleTarget === 0 ? 60 : 0), 1000)
  console.log(`xxx url ${JSON.stringify(props.url)}`)
  return (<Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Text type="BodySmall">before</Kb.Text>
    <Kb.NativeImage
      source={props.url}
      style={[styles[`image:${size}`], { borderRadius: size / 2 }]}
    />
    <Kb.Text type="BodySmall">middle</Kb.Text>
    <Kb.Animated to={{angle: angleTarget}}>
      {({ angle }) =>
        <svg height="50%" width="50%" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="green"
            strokeWidth="5"
            fill="blue"
          />
          <rect
            x="15"
            y="15"
            width="70"
            height="70"
            fill="yellow"
            transform={`rotate(${angle})`}
          />
        </svg>
      }
    </Kb.Animated>
    <Kb.Text type="BodySmall">after</Kb.Text>
  </Kb.Box2>)
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    width: 100,
    height: 100,
  },
}))

export default AvatarAnim
