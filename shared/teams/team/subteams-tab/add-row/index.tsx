import * as React from 'react'
import {Box, ClickableBox, Icon, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles} from '../../../../styles'

const Add = ({onCreateSubteam}: {onCreateSubteam: () => void}) => (
  <Box style={addSubteamStyle}>
    <ClickableBox
      onClick={onCreateSubteam}
      style={{...globalStyles.flexBoxRow, alignItems: 'center', flexGrow: 1, justifyContent: 'center'}}
    >
      <Icon type="iconfont-new" color={globalColors.blue} />
      <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>
        Create subteam
      </Text>
    </ClickableBox>
  </Box>
)

const addSubteamStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    padding: globalMargins.tiny,
    width: '100%',
  },
  isMobile: {
    paddingTop: globalMargins.small,
  },
})

export default Add
