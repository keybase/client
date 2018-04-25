// @flow
import * as React from 'react'
import {collapseStyles, globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
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
        marginLeft: globalMargins.tiny,
        marginRight: globalMargins.tiny,
        paddingTop: globalMargins.tiny,
        paddingBottom: globalMargins.tiny,
        alignItems: 'center',
      }}
    >
      <Checkbox checked={true} />
      <Box style={{display: 'flex', position: 'relative'}}>
        <Avatar
          isTeam={true}
          size={isMobile ? 48 : 32}
          style={{marginRight: globalMargins.tiny}}
          teamname={name}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySemibold">{name}</Text>
          {isOpen && <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />}
        </Box>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Text type="BodySmall">foo is already a member</Text>
        </Box>
      </Box>
    </Box>
    {!isMobile && <Divider style={{marginLeft: 48}} />}
  </Box>
)

const AddToTeam = (props: Props) => (
  <Box style={styleContainer}>
    <Box style={collapseStyles([globalStyles.flexBoxRow, {paddingBottom: globalMargins.small}])}>
      <Text type="Header">
        Add
      </Text>
      <Avatar isTeam={false} size={16} style={{marginLeft: globalMargins.tiny}} username={props.them} />
      <Text type="Header">{props.them} to...</Text>
    </Box>

    <ScrollView>
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
}

const styleMeta = {
  alignSelf: 'center',
  borderRadius: 1,
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const PopupWrapped = (props: Props) => (
  <PopupDialog styleCover={{zIndex: 20}} onClose={props.onBack}>
    <AddToTeam {...props} />
  </PopupDialog>
)
export default (isMobile ? AddToTeam : PopupWrapped)
