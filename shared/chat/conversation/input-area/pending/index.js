// @flow
import * as React from 'react'
import {Box, Text} from '../../../../common-adapters'
import {type PendingStatus} from '../../../../constants/types/chat2/index'
import {
  backgroundModeToColor,
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
} from '../../../../styles'

export type Props = {
  onCancel: () => void,
  onRetry: () => void,
  pendingStatus: PendingStatus,
}

export default (props: Props) => {
  let backgroundMode = 'Announcements'
  if (props.pendingStatus === 'failed') {
    backgroundMode = 'HighRisk'
  }
  const backgroundColor = backgroundModeToColor[backgroundMode]
  return (
    <Box style={collapseStyles([styleContainer, {backgroundColor}])}>
      <Text type="BodySemibold" backgroundMode={backgroundMode}>
        Error creating conversation
      </Text>
      <Box style={globalStyles.flexBoxRow}>
        <Text type="BodySemiboldLink" backgroundMode={backgroundMode} onClick={props.onRetry}>
          Retry
        </Text>
        <Text
          type="BodySemiboldLink"
          style={{marginLeft: globalMargins.tiny}}
          backgroundMode={backgroundMode}
          onClick={props.onCancel}
        >
          Cancel
        </Text>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}
