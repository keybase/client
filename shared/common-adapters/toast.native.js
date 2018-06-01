// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import Box from './box'
import {globalColors, globalMargins, styleSheetCreate} from '../styles'
import type {Props} from './toast'

export default (props: Props) =>
  props.visible ? (
    <FloatingBox onHidden={() => {}}>
      <Box style={styles.wrapper}>
        <Box style={styles.container}>{props.children}</Box>
      </Box>
    </FloatingBox>
  ) : null

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.black_75,
    borderRadius: 70,
    borderWidth: 0,
    display: 'flex',
    justifyContent: 'center',
    margin: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
    width: 140,
    height: 140,
  },
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
