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
import {teamWaitingKey} from '../../constants/teams'

import type {RowProps, Props} from './index'

const TeamRow = ({
  canShowcase,
  name,
  isOpen,
  membercount,
  onPromote,
  showcased,
  waiting,
  isExplicitMember,
}: RowProps) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box
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
          {isOpen && <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />}
        </Box>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Text type="BodySmall">{membercount + ' member' + (membercount !== 1 ? 's' : '')}</Text>
        </Box>
      </Box>
      {showcased || canShowcase || waiting ? (
        <Button
          label={showcased ? 'Published' : 'Publish'}
          onClick={() => onPromote(!showcased)}
          small={true}
          style={{minWidth: 72}}
          type={showcased ? 'PrimaryGreenActive' : 'PrimaryGreen'}
          waiting={waiting}
        />
      ) : (
        <Text style={{color: globalColors.black_40, width: isMobile ? '35%' : '25%'}} type="BodySmall">
          {isExplicitMember
            ? 'Admins aren’t allowing members to publish.'
            : 'You are not a member. Add yourself to publish.'}
        </Text>
      )}
    </Box>
    {!isMobile && <Divider style={{marginLeft: 48}} />}
  </Box>
)

const ShowcaseTeamOffer = (props: Props) => (
  <Box style={styleContainer}>
    <Text style={{paddingBottom: globalMargins.small}} type="Header">
      Publish the teams you're in
    </Text>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: globalMargins.tiny}}>
      <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
      <Icon
        style={{
          paddingLeft: globalMargins.tiny,
          paddingRight: globalMargins.tiny,
        }}
        color={globalColors.black_10}
        type="iconfont-info"
      />
      <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
    </Box>

    <ScrollView>
      <Box style={{...globalStyles.flexBoxRow, flexShrink: 1, width: '100%'}}>
        <Text
          style={{
            color: globalColors.black_40,
            paddingBottom: globalMargins.small,
            paddingLeft: globalMargins.large,
            paddingRight: globalMargins.large,
            paddingTop: globalMargins.tiny,
            textAlign: 'center',
          }}
          type="BodySmall"
        >
          Promoting a team will encourage others to ask to join. The team's description and number of members
          will be public.
        </Text>
      </Box>
      <Box style={{flexShrink: 1, width: '100%'}}>
        {props.teamnames &&
          props.teamnames.map(name => (
            <TeamRow
              canShowcase={
                (props.teamNameToRole[name] !== 'none' && props.teamNameToAllowPromote[name]) ||
                ['admin', 'owner'].indexOf(props.teamNameToRole[name]) !== -1
              }
              isExplicitMember={props.teamNameToRole[name] !== 'none'}
              key={name}
              name={name}
              isOpen={props.teamNameToIsOpen[name]}
              membercount={props.teammembercounts[name]}
              onPromote={promoted => props.onPromote(name, promoted)}
              showcased={props.teamNameToIsShowcasing[name]}
              waiting={!!props.waiting[teamWaitingKey(name)]}
            />
          ))}
      </Box>
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
  marginBottom: isMobile ? globalMargins.xtiny : 55,
  minWidth: isMobile ? undefined : 600,
}

const styleMeta = {
  alignSelf: 'center',
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const PopupWrapped = (props: Props) => (
  <PopupDialog styleCover={{zIndex: 20}} onClose={props.onBack}>
    <ShowcaseTeamOffer {...props} />
  </PopupDialog>
)
export default (isMobile ? ShowcaseTeamOffer : PopupWrapped)
