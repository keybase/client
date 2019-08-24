import * as React from 'react'
import {Avatar, Box, ClickableBox, Text, ConnectedUsernames, WaitingButton} from '../../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../../styles'
import {typeToLabel} from '../../../../constants/teams'
import {TeamRoleType} from '../../../../constants/types/teams'

export type Props = {
  label: string
  onCancelInvite?: () => void
  role: TeamRoleType
}

export const TeamInviteRow = (props: Props) => {
  const {onCancelInvite, role, label} = props
  return (
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: isMobile ? 56 : 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
    >
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          height: '100%',
        }}
      >
        <Avatar username={label} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxRow, flexGrow: 1, height: '100%', position: 'relative'}}>
          <Box
            style={{
              ...globalStyles.fillAbsolute,
              ...globalStyles.flexBoxRow,
            }}
          >
            <Box style={{...globalStyles.flexBoxColumn, flexGrow: 1, marginLeft: globalMargins.small}}>
              <ConnectedUsernames
                type="BodySemibold"
                colorFollowing={true}
                inline={true}
                usernames={[label]}
              />
              <Box style={globalStyles.flexBoxRow}>
                <Text type="BodySmall">{role && typeToLabel[role]}</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Box style={{...globalStyles.flexBoxRow, marginLeft: globalMargins.xtiny}}>
        <WaitingButton
          small={true}
          label={isMobile ? 'Cancel' : 'Cancel invite'}
          onClick={onCancelInvite}
          type="Dim"
          waitingKey={null}
        />
      </Box>
    </ClickableBox>
  )
}
