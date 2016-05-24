// @flow
import React, {Component} from 'react'
import {Box, Text, BackButton, Avatar, PopupMenu} from '../../common-adapters'
import {globalStyles} from '../../styles/style-guide'
import {intersperseFn} from '../../util/arrays'

export default class Render extends Component {
  render () {
    const isPrivate = this.props.theme === 'private'
    return (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <BackButton onClick={this.props.onBack} />
          <Box style={{...globalStyles.flexBoxRow, flex: 2}}>
            {this.props.users.map(u => <Avatar key={u} username={u} size={32} />)}
          </Box>
          <PopupMenu visible={false} items={[]} onHidden={() => {}} />
        </Box>
        <Box style={{display: 'inline'}}>
          <Text type='BodySmall'>{isPrivate ? 'private/' : 'public/'}</Text>
          {intersperseFn(i => (<Text key={i} type='BodySmallSemibold'>,</Text>), this.props.users.map(u => (
            <Text key={u} type='BodySmallSemibold' style={this.props.selfUsename === u ? globalStyles.italic : {}}>{u}</Text>
          )))}
        </Box>

      </Box>

    )
  }
}
