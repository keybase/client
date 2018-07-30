// @flow
import * as React from 'react'
import {Box2, FloatingBox} from '..'
import type {Props} from '.'
import {collapseStyles, platformStyles, styleSheetCreate} from '../../styles'

const Overlay = (props: Props) => {
  if (props.hasOwnProperty('visible') && !props.visible) {
    return null
  }
  return (
    <FloatingBox
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position={props.position || 'top center'}
      positionFallbacks={props.positionFallbacks}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      <Box2 direction="vertical" style={collapseStyles([styles.container, props.style])}>
        {props.children}
      </Box2>
    </FloatingBox>
  )
}

const styles = styleSheetCreate({
  container: platformStyles({
    isElectron: {
      borderRadius: 3,
      boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.2)',
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
})

export default Overlay
