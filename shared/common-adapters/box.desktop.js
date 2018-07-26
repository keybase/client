// @flow
import * as React from 'react'
import {globalStyles, collapseStyles, globalMargins} from '../styles'
import {intersperseFn} from '../util/arrays'
import type {Box2Props} from './box'

class Box extends React.Component<any> {
  render() {
    return <div {...this.props} />
  }
}

const injectGaps = (Component, _children, gap, gapStart, gapEnd) => {
  let children = _children
  if (gap) {
    children = intersperseFn(index => <Component key={index} gap={gap} />, React.Children.toArray(_children))
    if (gapStart) {
      children.unshift(<Component key="gapStart" gap={gap} />)
    }
    if (gapEnd) {
      children.push(<Component key="gapEnd" gap={gap} />)
    }
  }

  return children
}

class Box2 extends React.Component<Box2Props> {
  render() {
    let horizontal = this.props.direction === 'horizontal' || this.props.direction === 'horizontalReverse'
    let directionStyle
    switch (this.props.direction) {
      case 'horizontal':
        directionStyle = styles.hbox
        break
      case 'horizontalReverse':
        directionStyle = styles.hrbox
        break
      case 'verticalReverse':
        directionStyle = styles.vrbox
        break
      case 'vertical':
      default:
        directionStyle = styles.vbox
        break
    }

    const style = collapseStyles([
      directionStyle,
      this.props.fullHeight && styles.fullHeight,
      this.props.fullWidth && styles.fullWidth,
      !this.props.fullHeight && !this.props.fullWidth && styles.centered,
      this.props.centerChildren && styles.centeredChildren,
      // uncomment this to get debugging colors
      // {backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`},
      this.props.style,
    ])
    return (
      <div
        onMouseLeave={this.props.onMouseLeave}
        onMouseOver={this.props.onMouseOver}
        style={style}
        className={this.props.className}
      >
        {injectGaps(
          horizontal ? HBoxGap : VBoxGap,
          this.props.children,
          this.props.gap,
          this.props.gapStart,
          this.props.gapEnd
        )}
      </div>
    )
  }
}
const VBoxGap = ({gap}) => <div style={{flexShrink: 0, height: globalMargins[gap]}} />
const HBoxGap = ({gap}) => <div style={{flexShrink: 0, width: globalMargins[gap]}} />

const styles = {
  centered: {alignSelf: 'center'},
  centeredChildren: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeight: {height: '100%'},
  fullWidth: {width: '100%'},
  vbox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  vrbox: {
    ...globalStyles.flexBoxColumnReverse,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  hbox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  hrbox: {
    ...globalStyles.flexBoxRowReverse,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
}

export default Box
export {Box, Box2}
