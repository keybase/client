// @flow
import * as React from 'react'
import Box from './box'
import {globalStyles, glamorous} from '../styles'
import {isMobile} from '../constants/platform'

type Props = {
  direction: 'row' | 'column',
  align?: 'flex-start' | 'flex-end' | 'center',
  children: React.Node,
  fullWidth?: boolean,
  small?: boolean,
  style?: any,
}

class ButtonBar extends React.PureComponent<Props> {
  static defaultProps = {
    align: 'center',
    direction: 'row',
    fullWidth: false,
    small: false,
  }

  constructor(props: Props) {
    super(props)

    if (__DEV__) {
      // I tried to get flow to do this but it got really confused so we get a dev only runtime check instead
      if (props.direction === 'column') {
        const keys = Object.keys(props)
        const rowOnlyKeys = [('align', 'fullWidth', 'small')]
        rowOnlyKeys.forEach(k => {
          if (keys.includes(k)) {
            throw new Error(`Invalid key passed to ButtonBar ${k}`)
          }
        })
      }
    }
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

const Container = glamorous(Box)(
  {
    width: '100%',
  },
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
