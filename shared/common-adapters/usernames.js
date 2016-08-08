// @flow
import React, {Component} from 'react'
import type {Props} from './usernames'
import {Box, Text} from './'
import {globalStyles, globalColors} from '../styles/style-guide'
import {isMobile} from '../constants/platform'

function usernameText ({type, users, style, inline, redColor}: Props) {
  return users.map((u, i) => {
    const userStyle = {...style}

    if (!isMobile) {
      userStyle.textDecoration = 'inherit'
    }

    if (u.broken) {
      userStyle.color = redColor || globalColors.red
    }

    if (inline) {
      userStyle.display = 'inline-block'
    }

    if (u.you) {
      Object.assign(userStyle, globalStyles.italic)
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

    return (
      <Box style={{...containerStyle, ...(isMobile ? {} : {textDecoration: 'inherit'})}}>
        {usernameText(this.props)}
      </Box>
    )
  }
}

export {
  usernameText,
}

export default Usernames
