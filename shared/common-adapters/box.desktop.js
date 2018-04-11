// @flow
import * as React from 'react'
import {type StylesCrossPlatform, globalStyles, collapseStyles} from '../styles'
import {intersperseFn} from '../util/arrays'

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
      children.unshift(<HBoxGap key="gapStart" gap={gap} />)
    }
    if (gapEnd) {
      children.push(<HBoxGap key="gapEnd" gap={gap} />)
    }
  }

  return children
}

type VBoxProps = {
  children: React.Node,
  fullHeight?: true,
  centered?: true,
  style?: StylesCrossPlatform,
  gap?: number,
  gapStart?: boolean,
  gapEnd?: boolean,
}
class VBox extends React.Component<VBoxProps> {
  render() {
    const style = collapseStyles([
      this.props.fullHeight ? styles.vboxFullHeight : styles.vbox,
      this.props.centered ? styles.vboxCentered : null,
      this.props.style,
    ])
    return (
      <div style={style}>
        {injectGaps(VBoxGap, this.props.children, this.props.gap, this.props.gapStart, this.props.gapEnd)}
      </div>
    )
  }
}
const VBoxGap = ({gap}) => <div style={{height: gap}} />

type HBoxProps = {
  children: React.Node,
  fullWidth?: true,
  style?: StylesCrossPlatform,
  gap?: number,
  gapStart?: boolean,
  gapEnd?: boolean,
}
class HBox extends React.Component<HBoxProps> {
  render() {
    const style = collapseStyles([
      this.props.fullWidth ? styles.hboxFullWidth : styles.hbox,
      this.props.centered ? styles.hboxCentered : null,
      this.props.style,
    ])
    return (
      <div style={style}>
        {injectGaps(HBoxGap, this.props.children, this.props.gap, this.props.gapStart, this.props.gapEnd)}
      </div>
    )
  }
}
const HBoxGap = ({gap}) => <div style={{width: gap}} />

const styles = {
  hbox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    height: '100%',
  },
  hboxCentered: {
    alignSelf: 'center',
    width: undefined,
  },
  hboxFullWidth: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    height: '100%',
    width: '100%',
  },
  vbox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    width: '100%',
  },
  vboxCentered: {
    alignSelf: 'center',
    width: undefined,
  },
  vboxFullHeight: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    height: '100%',
    justifyContent: 'flex-start',
    width: '100%',
  },
}

export default Box
export {Box, VBox, HBox}
