// @flow
import * as React from 'react'
import {ClickableBox, Box, Icon, ScrollView, Text} from '../common-adapters'
import {globalColors, globalStyles} from '../styles'

import type {Props} from './render'

function TeamsRender(props: Props) {
  // TODO: Find right icon for "Join a team" button.
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 48}}>
        <ClickableBox
          onClick={props.onCreateTeam}
          style={{...globalStyles.flexBoxRow, alignItems: 'center', marginRight: 40}}
        >
          <Icon type="iconfont-new" style={{color: globalColors.blue}} />
          <Text type="HeaderLink" style={{padding: 5}}>Create a team</Text>
        </ClickableBox>

        <ClickableBox onClick={props.onJoinTeam} style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Icon type="iconfont-new" style={{color: globalColors.blue}} />
          <Text type="HeaderLink" style={{padding: 5}}>Join a team</Text>
        </ClickableBox>
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
        <Text style={{textAlign: 'center', width: 426}} type="BodySmall">
          For now the GUI only allows you to create simple teams
          no channels or subteams, but you can get to more complex teams
          using the command line.
        </Text>
        <Text
          type="BodySmall"
          className="underline"
          onClick={props.onReadDoc}
          style={{...globalStyles.clickable}}
        >
          Read the doc
        </Text>
      </ScrollView>
    </Box>
  )
}

export default TeamsRender
