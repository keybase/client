// @flow
import * as React from 'react'
import Box from './box'
import {globalStyles, isMobile, globalMargins, collapseStyles} from '../styles'

type Props = {
  direction: 'row' | 'column',
  align?: 'flex-start' | 'flex-end' | 'center', // ignored by column
  children: React.Node,
  fullWidth?: boolean,
  noPadding?: boolean,
  small?: boolean, // ignored by column
  style?: any,
}

class ButtonBar extends React.PureComponent<Props> {
  static defaultProps = {
    align: 'center',
    direction: 'row',
    fullWidth: false,
    noPadding: false,
    small: false,
  }

  _spacing = () => {
    if (this.props.direction === 'row' && this.props.small && !isMobile) {
      return SmallSpacer
    }

    return BigSpacer
  }

  _surroundSpacing = () => {
    return this.props.direction === 'column'
  }

  render() {
    const Spacing = this._spacing()
    const surroundSpacing = this._surroundSpacing()
    const children = React.Children.toArray(this.props.children)
    const childrenWithSpacing = children.reduce((arr, c, idx) => {
      if (surroundSpacing || idx > 0) {
        arr.push(<Spacing key={arr.length} />)
      }
      arr.push(c)
      if (surroundSpacing && idx === children.length - 1) {
        arr.push(<Spacing key={arr.length} />)
      }
      return arr
    }, [])

    let minHeight = {}
    if (!this.props.noPadding) {
      minHeight = {
        minHeight: isMobile ? (this.props.small ? 64 : 72) : this.props.small ? 44 : 64,
      }
    }

    const style = collapseStyles([
      {
        alignItems: this.props.fullWidth ? 'stretch' : 'center',
        padding: this.props.fullWidth && !this.props.noPadding ? globalMargins.small : 0,
        width: '100%',
        ...(this.props.direction === 'column'
          ? {...globalStyles.flexBoxColumn}
          : {
              ...globalStyles.flexBoxRow,
              justifyContent: this.props.align,
              ...minHeight,
            }),
      },
      this.props.style,
    ])

    return <Box style={style}>{childrenWithSpacing}</Box>
  }
}

// Note explicitly not using globalMargins here. We don't necessarily want this spacing to change ever
const BigSpacer = () => <Box style={bigSpacerStyle} />
const bigSpacerStyle = {
  height: 8,
  width: 8,
}
const SmallSpacer = () => <Box style={smallSpacerStyle} />
const smallSpacerStyle = {
  height: isMobile ? 8 : 4,
  width: isMobile ? 8 : 4,
}

export default ButtonBar
