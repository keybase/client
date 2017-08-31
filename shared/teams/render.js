// @flow
import * as React from 'react'
import type {IconType} from '../common-adapters/icon.constants'
import {ClickableBox, Box, Icon, ScrollView, Text} from '../common-adapters'
import {globalColors, globalStyles} from '../styles'

import type {Props} from './render'

type HeaderButtonProps = {
  iconType: IconType,
  label: string,
  onClick: () => void,
}

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox
    onClick={props.onClick}
    style={{...globalStyles.flexBoxRow, alignItems: 'center', marginRight: 40}}
  >
    <Icon type={props.iconType} style={{color: globalColors.blue}} />
    <Text type="HeaderLink" style={{padding: 5}}>{props.label}</Text>
  </ClickableBox>
)

type HeaderProps = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
}

const Header = (props: HeaderProps) => (
  <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 48}}>
    <HeaderButton iconType="iconfont-new" label="Create a team" onClick={props.onCreateTeam} />
    <HeaderButton iconType="iconfont-team-join" label="Join a team" onClick={props.onJoinTeam} />
  </Box>
)

const TeamsRender = (props: Props) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
      <Header {...props} />
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
