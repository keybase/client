// @flow
import * as React from 'react'
import {FloatingBox, Icon} from '../../../../common-adapters'
import type {Props} from './rollout'

const Rollout = (props: Props) => (
  <FloatingBox attachTo={props.attachTo} position="bottom center" propagateOutsideClicks={true}>
    <Icon type="iconfont-reacji-wave" onClick={() => props.onAddReaction(':wave:')} />
  </FloatingBox>
)

export default Rollout
