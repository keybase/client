// @flow
import * as React from 'react'
import {isMobile} from '../../styles'
import {rowStyles, StillCommon, type StillCommonProps} from './styles'
import {Badge, Box, Box2, Text} from '../../common-adapters'

type TlfTypeProps = StillCommonProps & {
  badgeCount: number,
}

const RowMeta = ({badgeCount}) => {
  if (!badgeCount) {
    return null
  }

  return (
    <Box style={{width: 0, display: 'flex'}}>
      <Box style={rowStyles.badgeContainer}>
        {!!badgeCount && <Badge badgeNumber={badgeCount} badgeStyle={rowStyles.badgeCount} />}
      </Box>
    </Box>
  )
}

const TlfType = (props: TlfTypeProps) => (
  <StillCommon
    itemStyles={props.itemStyles}
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    openInFileUI={props.openInFileUI}
  >
    <RowMeta badgeCount={props.badgeCount} />
    <Box style={rowStyles.itemBox}>
      <Box2 direction="horizontal" fullWidth={true}>
        <Text
          type={props.itemStyles.textType}
          style={{...rowStyles.rowText, color: props.itemStyles.textColor}}
          lineClamp={isMobile ? 1 : undefined}
        >
          {props.name}
        </Text>
      </Box2>
    </Box>
  </StillCommon>
)

export default TlfType
