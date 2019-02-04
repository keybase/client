// @flow
import * as React from 'react'
import {collapseStyles, platformStyles, styleSheetCreate} from '../styles'
import type {Props} from './scroll-view'

const ScrollView = (props: Props) => {
  const {contentContainerStyle, style, ...rest} = props
  return (
    <div style={collapseStyles([styles.overflowAuto, style])} onScroll={props.onScroll}>
      <div style={contentContainerStyle} {...rest} />
    </div>
  )
}

const styles = styleSheetCreate({
  overflowAuto: platformStyles({
    isElectron: {
      overflow: 'auto',
    },
  }),
})

export default ScrollView
