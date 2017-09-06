// @flow
import * as React from 'react'
import {Avatar, Box, Divider, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

import type {Teamname} from '../../constants/teams'

export type Props = {
  // TODO: Change to map to member count.
  teamnames: Array<Teamname>,
  // TODO: Add onClick handler and folder/chat icons.
}

const TeamList = (props: Props) => (
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

export default TeamList
