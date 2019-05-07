// @flow
import * as React from 'react'
import Box from './box'
import {globalStyles, isMobile, collapseStyles} from '../styles'

type Props = {
  direction: 'row' | 'column',
  align?: 'flex-start' | 'flex-end' | 'center', // ignored by column
  children: React.Node,
  fullWidth?: boolean,
  small?: boolean, // ignored by column
  style?: any,
}

class ButtonBar extends React.PureComponent<Props> {
  static defaultProps = {
    align: 'center',
    direction: 'row',
    fullWidth: false,
    small: false,
  }

  _surroundSpacing = () => {
    return this.props.direction === 'column'
  }

  render() {
    const surroundSpacing = this._surroundSpacing()
    const children = React.Children.toArray(this.props.children)
    const childrenWithSpacing = children.reduce((arr, c, idx) => {
      if (surroundSpacing || idx > 0) {
        arr.push(<Spacer key={arr.length} />)
      }
      arr.push(c)
      if (surroundSpacing && idx === children.length - 1) {
        arr.push(<Spacer key={arr.length} />)
      }
      return arr
    }, [])

    const minHeight = {
      minHeight: isMobile ? (this.props.small ? 48 : 72) : this.props.small ? 40 : 56,
    }

    const style = collapseStyles([
      {
        alignItems: this.props.fullWidth ? 'stretch' : 'center',
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
const Spacer = () => <Box style={spacerStyle} />
const spacerStyle = {
  flexShrink: 0,
  height: 8,
  width: 8,
}

export default ButtonBar
