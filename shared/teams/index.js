// @flow
import * as React from 'react'
import {Avatar, ClickableBox, Box, Divider, Icon, ScrollView, Text} from '../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {isMobile} from '../constants/platform'
import type {Teamname} from '../constants/teams'
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

type BannerProps = {
  onReadMore: () => void,
  onHideBanner: () => void,
}

const Banner = ({onReadMore, onHideBanner}: BannerProps) => (
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
      <Text backgroundMode="Terminal" type="BodySemiboldLink" className="underline" onClick={onReadMore}>
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
  onReadMore: () => void,
}

const BetaNote = (props: BetaNoteProps) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      marginBottom: globalMargins.small,
      marginTop: globalMargins.small,
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
      <Icon
        style={{
          color: globalColors.black_10,
          paddingLeft: globalMargins.tiny,
          paddingRight: globalMargins.tiny,
        }}
        type="iconfont-info"
      />
      <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
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
      onClick={props.onReadMore}
      style={{...globalStyles.clickable}}
    >
      Read more
    </Text>
  </Box>
)

type TeamListProps = {
  // TODO: Change to map to member count.
  teamnames: Array<Teamname>,
  // TODO: Add onClick handler and folder/chat icons.
}

const TeamList = (props: TeamListProps) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      paddingBottom: globalMargins.tiny,
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
      paddingTop: globalMargins.tiny,
      width: '100%',
    }}
  >
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

type Props = HeaderProps & BetaNoteProps & TeamListProps & BannerProps

const Render = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
    <Header {...props} />
    <Box style={{flex: 1, position: 'relative', width: '100%'}}>
      <ScrollView
        style={globalStyles.fillAbsolute}
        contentContainerStyle={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
        }}
      >
        <Banner onReadMore={props.onReadMore} onHideBanner={props.onHideBanner} />
        <TeamList {...props} />
        <BetaNote {...props} />
      </ScrollView>
    </Box>
  </Box>
)

export default Render

export {Header, BetaNote, TeamList}
