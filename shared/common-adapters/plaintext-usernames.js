// @flow
import React, {Component} from 'react'
import Text from './text'
import shallowEqual from 'shallowequal'
import {isMobile} from '../constants/platform'

import type {Props} from './plaintext-usernames'

const inlineStyle = isMobile
  ? {}
  : {
      display: 'inline',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
    }

const inlineProps = isMobile ? {lineClamp: 1} : {}

class PlaintextUsernames extends Component<void, Props, void> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'containerStyle', 'users'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const containerStyle = inlineStyle
    const rwers = this.props.users.filter(u => !u.readOnly)

    return (
      <Text
        type={this.props.type}
        backgroundMode={this.props.backgroundMode}
        style={{...containerStyle, ...this.props.containerStyle}}
        title={this.props.title}
        {...inlineProps}
      >
        {this.props.prefix}
        {rwers.map(u => u.username).join(this.props.divider || ', ')}
        {this.props.suffix}
      </Text>
    )
  }
}

export default PlaintextUsernames
