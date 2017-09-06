// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

export type Props = {
  onReadMore: () => void,
}

const BetaNote = (props: Props) => (
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

export default BetaNote
