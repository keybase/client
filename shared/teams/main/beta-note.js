// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, desktopStyles, platformStyles} from '../../styles'

export type Props = {
  onReadMore: () => void,
}

const BetaNote = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      marginBottom: globalMargins.small,
      marginLeft: globalMargins.medium,
      marginRight: globalMargins.medium,
      marginTop: globalMargins.small,
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: globalMargins.tiny}}>
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
    <Text
      type="BodySmallSemibold"
      className="hover-underline"
      onClick={props.onReadMore}
      style={platformStyles({isElectron: {...desktopStyles.clickable}})}
    >
      Read more about teams here
    </Text>
  </Box>
)

export default BetaNote
