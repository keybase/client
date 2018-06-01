// @flow
import * as React from 'react'
import type {Props} from './toast'
import FloatingBox from './floating-box'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../styles'

export default (props: Props) =>
  props.visible ? (
    <FloatingBox
      containerStyle={collapseStyles([styles.container, props.containerStyle])}
      onHidden={() => {}}
      attachTo={props.attachTo}
      propagateOutsideClicks={true}
      position={props.position}
    >
      {props.children}
    </FloatingBox>
  ) : null

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
