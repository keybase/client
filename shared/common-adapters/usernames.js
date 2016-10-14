// @flow
import React, {Component} from 'react'
import type {Props} from './usernames'
import {Box, Text} from './'
import {globalStyles, globalColors} from '../styles'
import {isMobile} from '../constants/platform'

function usernameText ({type, users, style, inline, redColor}: Props) {
  return users.map((u, i) => {
    const userStyle = {
      ...style,
      ...(!isMobile ? {textDecoration: 'inherit'} : null),
      ...(u.broken ? {color: redColor || globalColors.red} : null),
      ...(inline ? {display: 'inline-block'} : null),
      ...(u.you ? globalStyles.italic : null),
    }

    return (
      <Text
        key={u.username}
        type={type}
        style={userStyle}>{u.username}
        {
          (i !== users.length - 1) && // Injecting the commas here so we never wrap and have newlines starting with a ,
            <Text type={type} style={{...style, marginRight: 1}}>,</Text>}
      </Text>
    )
  })
}

class Usernames extends Component<void, Props, void> {
  render () {
    const containerStyle = this.props.inline ? {display: 'inline'} : {...globalStyles.flexBoxRow, flexWrap: 'wrap'}
    const rwers = this.props.users.filter(u => !u.readOnly)
    const readers = this.props.users.filter(u => !!u.readOnly)

    return (
      <Box style={{...containerStyle, ...(isMobile ? {} : {textDecoration: 'inherit'})}}>

        {usernameText({...this.props, users: rwers})}
        {!!readers.length && <Text type={this.props.type} style={{...this.props.style, marginRight: 1}}>#</Text>}
        {usernameText({...this.props, users: readers})}
      </Box>
    )
  }
}

export {
  usernameText,
}

export default Usernames
