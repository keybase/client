// @flow
import * as React from 'react'
import Box from './box'
import * as Styles from '../styles'

type Props = {
  align?: 'flex-start' | 'flex-end' | 'center' | 'space-between', // ignored by column
  bottomBorder?: boolean,
  children: React.Node,
  direction: 'row' | 'column',
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

  _spacing = () => {
    if (this.props.direction === 'row' && this.props.small && !Styles.isMobile) {
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

    const minHeight = {
      minHeight: Styles.isMobile ? (this.props.small ? 64 : 72) : this.props.small ? 44 : 64,
    }

    const style = Styles.collapseStyles([
      {
        alignItems: this.props.fullWidth ? 'stretch' : 'center',
        width: '100%',
        ...(this.props.bottomBorder
          ? {
              borderBottomColor: Styles.globalColors.black_10,
              borderBottomWidth: Styles.hairlineWidth,
            }
          : {}),
        ...(this.props.direction === 'column'
          ? {...Styles.globalStyles.flexBoxColumn}
          : {
              ...Styles.globalStyles.flexBoxRow,
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
  height: Styles.isMobile ? 8 : 4,
  width: Styles.isMobile ? 8 : 4,
}

export default ButtonBar
