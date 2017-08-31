// @flow
import * as React from 'react'
import type {IconType} from '../common-adapters/icon.constants'
import {ClickableBox, Box, Icon, ScrollView, Text} from '../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../styles'

import type {Props} from './render'

type HeaderButtonProps = {
  iconType: IconType,
  label: string,
  onClick: () => void,
}

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox
    onClick={props.onClick}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: globalMargins.medium,
      marginRight: globalMargins.medium,
    }}
  >
    <Icon type={props.iconType} style={{color: globalColors.blue}} />
    <Text type="HeaderLink" style={{margin: globalMargins.tiny}}>{props.label}</Text>
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

type BetaNoteProps = {
  onReadDoc: () => void,
}

const BetaNote = (props: BetaNoteProps) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Box style={{...globalStyles.flexBoxRow}}>
      <Text type="BodySmall">&mdash;&mdash;</Text>
      <Icon
        style={{paddingLeft: globalMargins.tiny, paddingRight: globalMargins.tiny}}
        type="iconfont-info"
      />
      <Text type="BodySmall">&mdash;&mdash;</Text>
    </Box>
    <Text type="BodySmall">Teams are still very early-stage!</Text>
    <Text style={{maxWidth: 426, textAlign: 'center'}} type="BodySmall">
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
  </Box>
)

// TODO: Add banner and team rows.
const Render = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
    <Header {...props} />
    <ScrollView
      style={{alignSelf: 'stretch'}}
      contentContainerStyle={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        margin: globalMargins.tiny,
      }}
    >
      <BetaNote {...props} />
    </ScrollView>
  </Box>
)

export default Render
