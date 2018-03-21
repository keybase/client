// @flow
import * as React from 'react'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import {
  Avatar,
  Box,
  Button,
  ClickableBox,
  Divider,
  Icon,
  Meta,
  PopupDialog,
  ScrollView,
  Text,
} from '../../common-adapters'

import type {Props} from './index'

const TeamRow = ({name, isOpen, membercount, memberShowcased, onPromote}: RowProps) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box
      key={name}
      style={{
        ...globalStyles.flexBoxRow,
        minHeight: isMobile ? 64 : 48,
        marginRight: globalMargins.small,
        paddingTop: globalMargins.tiny,
        paddingBottom: globalMargins.tiny,
      }}
    >
      <Box style={{display: 'flex', position: 'relative'}}>
        <Avatar
          isTeam={true}
          size={isMobile ? 48 : 32}
          style={{marginLeft: globalMargins.tiny}}
          teamname={name}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.small}}>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySemibold">{name}</Text>
          {isOpen && <Meta title="OPEN" style={styleMeta} />}
        </Box>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Text type="BodySmall">{membercount + ' member' + (membercount !== 1 ? 's' : '')}</Text>
        </Box>
      </Box>
      {memberShowcased ?
        <Button label="Published" small={true} type="PrimaryGreenActive" /> :
        <Button label="Publish" small={true} type="PrimaryGreen" />
      }
    </Box>
    {!isMobile && <Divider style={{marginLeft: 48}} />}
  </Box>
)

const ShowcaseTeamOffer = (props: Props) => (
  <Box style={styleContainer}>
    <Text style={{paddingBottom: globalMargins.small}} type="Header">
      Publish the teams you're in
    </Text>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: globalMargins.xtiny}}>
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

    <Text style={{color: globalColors.black_40, paddingTop: globalMargins.tiny, textAlign: 'center'}} type="Body">
      Promoting a team will encourage others to ask to join.
    </Text>
    <Text
      style={{color: globalColors.black_40, paddingTop: globalMargins.tiny, textAlign: 'center'}}
      type="Body"
    >
      The team's description and number of members will be public.
    </Text>

    <ScrollView style={{flexShrink: 1, marginTop: globalMargins.medium, width: '100%'}}>
      {props.teamnames &&
        props.teamnames.map(name => (
          <TeamRow
            key={name}
            name={name}
            isOpen={props.teamNameToIsOpen[name]}
            membercount={props.teammembercounts[name]}
            memberShowcased={props.teamNameToPublicitySettings[name] && props.teamNameToPublicitySettings[name].member}
            onPromote={() => props.onPromote(name)}
          />
        ))}
    </ScrollView>
    <ClickableBox onClick={props.onBack} style={{flexGrow: 1}}>
      <Button style={{margin: globalMargins.small}} type="Secondary" onClick={props.onBack} label="Close" />
    </ClickableBox>
  </Box>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  marginTop: 35,
  marginBottom: isMobile ? 35 : 55,
  minWidth: isMobile ? undefined : 600,
}

const styleMeta = {
  alignSelf: 'center',
  backgroundColor: globalColors.green,
  borderRadius: 1,
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const styleShowcasedTeamContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: 32,
}

const styleShowcasedTeamAvatar = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
  height: globalMargins.medium,
  minHeight: globalMargins.medium,
  minWidth: globalMargins.medium,
  width: globalMargins.medium,
  marginLeft: globalMargins.tiny,
}

const styleShowcasedTeamName = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  marginLeft: globalMargins.tiny,
}

const PopupWrapped = (props: RolePickerProps) => (
  <PopupDialog styleCover={{zIndex: 20}} onClose={props.onBack}>
    <ShowcaseTeamOffer {...props} />
  </PopupDialog>
)
export default (isMobile ? ShowcaseTeamOffer : PopupWrapped)
