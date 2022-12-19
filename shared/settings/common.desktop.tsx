import {Box, Icon} from '../common-adapters'
import range from 'lodash/range'
import {globalStyles, globalColors} from '../styles'

function Stars({count}: {count: number}) {
  return (
    <Box style={globalStyles.flexBoxRow}>
      {range(count).map(i => (
        <Icon key={i} color={globalColors.green} type="iconfont-star" />
      ))}
    </Box>
  )
}

export {Stars}
