// @flow
import * as React from 'react'
import type {IconType} from '../common-adapters/icon.constants'
import {Avatar, Box, ClickableBox, Divider, Icon, ScrollView, Text} from '../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {isMobile} from '../constants/platform'

import type {Teamname} from '../constants/teams'

type HeaderButtonProps = {
  iconType: IconType,
  label: string,
  onClick: () => void,
}

const marginHorizontal = isMobile ? globalMargins.tiny : globalMargins.medium
const headerButtonBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginLeft: marginHorizontal,
  marginRight: marginHorizontal,
}

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox onClick={props.onClick} style={headerButtonBoxStyle}>
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
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginTop: globalMargins.xlarge}}>
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
      with no channels or subteams, but you can get to more complex teams
      using the command line.
    </Text>
    <Text
      type="BodySmallSemibold"
      className="underline"
      onClick={props.onReadDoc}
      style={{...globalStyles.clickable}}
    >
      Read the doc
    </Text>
  </Box>
)

type TeamListProps = {
  // TODO: Change to map to member count.
  teamnames: Array<Teamname>,
  // TODO: Add onClick handler and folder/chat icons.
}

export const TeamList = (props: TeamListProps) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny, width: '100%'}}>
    {props.teamnames.map((name, index, arr) => {
      return (
        <Box key={name} style={rowStyle}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'center',
              flex: 1,
              marginRight: globalMargins.tiny,
            }}
          >
            <Avatar size={32} teamname={name} />
            <Text type="BodySemibold" style={{flex: 1, marginLeft: globalMargins.tiny}}>
              {name}
            </Text>
          </Box>
          {isMobile && <Divider style={{marginLeft: 44}} />}
        </Box>
      )
    })}
  </Box>
)

const rowStyle = {
  ...globalStyles.flexBoxColumn,
  minHeight: globalMargins.large,
}

type Props = HeaderProps & BetaNoteProps & TeamListProps

// TODO: Add banner.
const Render = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
    <Header {...props} />
    <ScrollView
      style={{alignSelf: 'stretch'}}
      contentContainerStyle={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
      }}
    >
      <TeamList {...props} />
      <BetaNote {...props} />
    </ScrollView>
  </Box>
)

export {Header, BetaNote}

export default Render
