// @flow
import * as React from 'react'
import {Box, Icon, ScrollView, Text} from '../common-adapters'
import {globalStyles} from '../styles'

import type {Props} from './render'

function TeamsRender(props: Props) {
  // TODO: Add link to "Read the doc" text, when a page to link to
  // exists.
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 48}}>
        <Text type="Body">Create a team</Text>
        <Text type="Body">Join a team</Text>
      </Box>
      <ScrollView
        style={{alignSelf: 'stretch'}}
        contentContainerStyle={{...globalStyles.flexBoxColumn, alignItems: 'center', margin: 10}}
      >
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text type="BodySmall">&mdash;&mdash;</Text>
          <Icon style={{paddingLeft: 5, paddingRight: 5}} type="iconfont-info" />
          <Text type="BodySmall">&mdash;&mdash;</Text>
        </Box>
        <Text type="BodySmall">Teams are still very early-stage!</Text>
        <Text type="BodySmall">
          For now the GUI only allows you to create simple teams
          no channels or subteams, but you can get to more complex teams
          using the command line.
        </Text>
        <Text type="BodySmall">Read the doc</Text>
      </ScrollView>
    </Box>
  )
}

export default TeamsRender
