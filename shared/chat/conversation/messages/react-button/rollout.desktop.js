// @flow
import * as React from 'react'
import {FloatingBox, Icon} from '../../../../common-adapters'
import type {Props} from './rollout'

const Rollout = (props: Props) =>
  !props.visible ? null : (
    <FloatingBox attachTo={props.attachTo} position="bottom center" propagateOutsideClicks={true}>
      <div onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave}>
        <Icon type="iconfont-reacji-wave" onClick={() => props.onAddReaction(':wave:')} />
      </div>
    </FloatingBox>
  )

export default Rollout
