// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Constants from '../../constants/fs'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import {Badge, Box, Box2, Text} from '../../common-adapters'

type TlfTypeProps = StillCommonProps & {
  badgeCount: number,
}

const RowMeta = ({badgeCount}) => {
  if (!badgeCount) {
    return null
  }

  return (
    <Box style={{display: 'flex', width: 0}}>
      <Box style={rowStyles.badgeContainer}>
        {!!badgeCount && <Badge badgeNumber={badgeCount} badgeStyle={rowStyles.badgeCount} />}
      </Box>
    </Box>
  )
}

const TlfType = (props: TlfTypeProps) => (
  <StillCommon
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
  >
    <RowMeta badgeCount={props.badgeCount} />
    <Box style={rowStyles.itemBox}>
      <Box2 direction="horizontal" fullWidth={true}>
        <Text
          type={Constants.pathTypeToTextType('folder')}
          style={Styles.collapseStyles([rowStyles.rowText, {color: Constants.getPathTextColor(props.path)}])}
          lineClamp={Styles.isMobile ? 1 : undefined}
        >
          {props.name}
        </Text>
      </Box2>
    </Box>
  </StillCommon>
)

export default TlfType
