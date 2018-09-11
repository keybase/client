// @flow
import * as React from 'react'
import type {Props} from './toast'
import FloatingBox from './floating-box'
import {collapseStyles, glamorous, globalColors, globalMargins, styleSheetCreate, transition} from '../styles'

const FadeBox = glamorous.div({
  ...transition('opacity'),
  '&.visible': {
    opacity: 1,
  },
  '&.active': {
    opacity: 1,
  },
  opacity: 0,
})

export default (props: Props) => (
  <FloatingBox attachTo={props.attachTo} propagateOutsideClicks={true} position={props.position}>
    <FadeBox
      className={props.visible ? 'visible' : null}
      style={collapseStyles([styles.container, props.containerStyle])}
    >
      {props.children}
    </FadeBox>
  </FloatingBox>
)

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.black_75,
    borderRadius: 100,
    borderWidth: 0,
    display: 'flex',
    justifyContent: 'center',
    margin: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
})
