// @flow
import React, {Component} from 'react'
import Text from './text'
import Icon from './icon'
import {globalStyles, desktopStyles, collapseStyles, type Color} from '../styles'

type Props = {
  badgeNumber?: number,
  onClick: () => void,
  onPress?: void,
  iconColor?: Color,
  textStyle?: Object,
  style?: ?Object,
  title?: ?string,
}

class BackButton extends Component<Props> {
  onClick(event: SyntheticEvent<>) {
    event.preventDefault()
    event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <div style={collapseStyles([styles.container, this.props.style])} onClick={e => this.onClick(e)}>
        <Icon type="iconfont-arrow-left" style={styles.icon} color={this.props.iconColor} />
        {this.props.title !== null && (
          <Text type="BodyPrimaryLink" style={this.props.textStyle} onClick={e => this.onClick(e)}>
            {this.props.title || 'Back'}
          </Text>
        )}
      </div>
    )
  }
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...desktopStyles.clickable,
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
}

export default BackButton
