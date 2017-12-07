// @flow
import * as React from 'react'
import Box from './box'
import {globalStyles, globalMargins, glamorous} from '../styles'
import {isMobile} from '../constants/platform'

type Props =
  | {
      align?: 'flex-start' | 'flex-end' | 'center',
      direction: 'row',
      fullWidth?: boolean,
      small?: boolean,
    }
  | {
      direction: 'column',
    }

class ButtonBar extends React.PureComponent<Props> {
  static defaultProps = {
    align: 'center',
    fullWidth: false,
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
        arr.push(<Spacing />)
      }
      arr.push(c)
      if (surroundSpacing && idx === children.length - 1) {
        arr.push(<Spacing />)
      }
      return arr
    }, [])
    return (
      <Container
        align={this.props.align}
        direction={this.props.direction}
        fullWidth={this.props.fullWidth}
        small={this.props.small}
        style={this.props.style}
      >
        {childrenWithSpacing}
      </Container>
    )
  }
}

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

const Container = glamorous(Box)(
  {},
  props =>
    props.direction === 'column'
      ? {
          ...globalStyles.flexBoxColumn,
          alignItems: props.fullWidth ? 'stretch' : 'center',
        }
      : {
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: props.align,
          minHeight: isMobile ? (props.small ? 64 : 72) : props.small ? 44 : 64,
        },
  props => props.style
)

export default ButtonBar
