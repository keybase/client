// @flow
import * as React from 'react'
import {Box2, FloatingBox, Icon} from '../../../../common-adapters'
import type {Props} from './rollout'

const Rollout = (props: Props) =>
  !props.visible ? null : (
    <FloatingBox
      attachTo={props.attachTo}
      position="bottom center"
      positionFallbacks={['top center']}
      propagateOutsideClicks={true}
    >
      <div onMouseOver={props.onMouseOver} onMouseLeave={props.onMouseLeave}>
        <Box2
          centerChildren={true}
          direction="vertical"
          gap="tiny"
          gapStart={true}
          gapEnd={true}
          style={{width: 37}}
        >
          <Icon type="iconfont-reacji-wave" onClick={() => props.onAddReaction(':wave:')} />
          <Icon type="iconfont-reacji-heart" onClick={() => props.onAddReaction(':heart:')} />
          <Icon type="iconfont-reacji-sheep" onClick={() => props.onAddReaction(':sheep:')} />
        </Box2>
      </div>
    </FloatingBox>
  )

export default Rollout
