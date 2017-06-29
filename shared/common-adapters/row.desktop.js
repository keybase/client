// @flow
import React, {PureComponent} from 'react'
import View from './view.desktop'

type Props = {
  leftContent?: React$Element<*> | Array<React$Element<*>>,
  middleContent?: React$Element<*> | Array<React$Element<*>>,
  onClick?: () => void,
  rightContent?: React$Element<*> | Array<React$Element<*>>,
}

class Row extends PureComponent<void, Props, void> {
  render() {
    return (
      <View height={40} onClick={this.props.onClick} direction="row">
        {this.props.leftContent &&
          <View height="100%" center={true} width={60}> {this.props.leftContent} </View>}
        {this.props.middleContent &&
          <View
            alignItems="flex-start"
            flexGrow={true}
            height="100%"
            justifyContent="center"
            rowDivider={true}
          >
            {this.props.middleContent}
          </View>}
        {this.props.rightContent && <View height="100%" center={true}> {this.props.rightContent} </View>}
      </View>
    )
  }
}

export default Row
