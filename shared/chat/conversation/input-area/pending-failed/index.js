// @flow
import * as React from 'react'
import {Box, Text} from '../../../../common-adapters'
import {backgroundModeToColor, globalMargins, globalStyles} from '../../../../styles'

export type Props = {
  onCancel: () => void,
  onRetry: () => void,
}

export default (props: Props) => (
  <Box style={styleContainer}>
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
const backgroundMode = 'HighRisk'

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: backgroundModeToColor[backgroundMode],
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}
