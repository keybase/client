// @flow
import * as React from 'react'
import {ClickableBox, Box, Icon, ScrollView, Text} from '../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {isMobile} from '../constants/platform'

import type {IconType} from '../common-adapters/icon.constants'

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
    <Text type={isMobile ? 'BodySemiboldLink' : 'HeaderLink'} style={{margin: globalMargins.tiny}}>
      {props.label}
    </Text>
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

const Banner = ({onReadDoc, onHideBanner}) => (
  <Box
    style={{
      ...(isMobile
        ? {
            ...globalStyles.flexBoxColumn,
            padding: 24,
          }
        : {
            ...globalStyles.flexBoxRow,
            height: 212,
          }),
      alignItems: 'center',
      backgroundColor: globalColors.blue,
      flexShrink: 0,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    }}
  >
    <Icon type={isMobile ? 'icon-illustration-teams-216' : 'icon-illustration-teams-180'} />
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...(isMobile ? {alignItems: 'center'} : {marginLeft: globalMargins.medium, maxWidth: 330}),
      }}
    >
      <Text
        backgroundMode="Terminal"
        type="Header"
        style={{
          marginBottom: 15,
          marginTop: 15,
        }}
      >
        Now supporting teams!
      </Text>
      <Text
        backgroundMode="Terminal"
        type="BodySemibold"
        style={{marginBottom: globalMargins.small, ...(isMobile ? {textAlign: 'center'} : {})}}
      >
        Keybase team chats are encrypted - unlike Slack - and work for any size group, from casual friends to large communities.
      </Text>
      <Text backgroundMode="Terminal" type="BodySemiboldLink" className="underline" onClick={onReadDoc}>
        Read our announcement
      </Text>
    </Box>
    <Icon
      type="iconfont-close"
      onClick={onHideBanner}
      style={{position: 'absolute', right: globalMargins.tiny, top: globalMargins.tiny}}
    />
  </Box>
)

type BetaNoteProps = {
  onReadDoc: () => void,
}

const BetaNote = (props: BetaNoteProps) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginTop: globalMargins.small}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Box style={{height: 1, width: 24, backgroundColor: globalColors.black_05}} />
      <Icon
        style={{
          paddingLeft: globalMargins.tiny,
          paddingRight: globalMargins.tiny,
          color: globalColors.black_10,
        }}
        type="iconfont-info"
      />
      <Box style={{height: 1, width: 24, backgroundColor: globalColors.black_05}} />
    </Box>
    <Text type="BodySmall">Teams are still very early-stage!</Text>
    <Text style={{maxWidth: 426, textAlign: 'center'}} type="BodySmall">
      For now the GUI only allows you to create simple teams
      with no channels or subteams, but you can get to more complex teams
      using the command line.
    </Text>
    <Text
      type="BodySmallSemibold"
      className="hover-underline"
      onClick={props.onReadDoc}
      style={{...globalStyles.clickable}}
    >
      Read the doc
    </Text>
  </Box>
)

type Props = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
  onReadDoc: () => void,
  onHideBanner: () => void,
}

// TODO: Add team rows.
const Render = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
    <Header {...props} />
    <Box style={{flex: 1, width: '100%'}}>
      <ScrollView
        style={{alignSelf: 'stretch', height: '100%', width: '100%'}}
        contentContainerStyle={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
        }}
      >
        <Banner onReadDoc={props.onReadDoc} onHideBanner={props.onHideBanner} />
        <BetaNote {...props} />
      </ScrollView>
    </Box>
  </Box>
)

export default Render

export {Header, BetaNote}
