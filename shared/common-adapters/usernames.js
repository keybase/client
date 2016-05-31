// @flow
import React, {Component} from 'react'
import {Box, Text} from './'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {Props} from './usernames'

export default class Usernames extends Component<void, Props, void> {
  render () {
    const {type, users, style} = this.props

    return (
      <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
        {users.map((u, i) => {
          const userStyle = {...style}

          if (u.broken) {
            userStyle.color = globalColors.red
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
        })}
      </Box>
    )
  }
}
