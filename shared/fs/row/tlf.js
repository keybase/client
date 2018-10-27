// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import {Box, Box2, Meta, Text} from '../../common-adapters'
import {PathItemInfo} from '../common'

type TlfProps = StillCommonProps & {
  isNew: boolean,
  isUserReset: boolean,
  needsRekey: boolean,
  resetParticipants: Array<string>,
  // We don't use this at the moment. In the future this will be used for
  // showing ignored folders when we allow user to show ignored folders in GUI.
  isIgnored: boolean,
}

const RowMeta = ({isNew, needsRekey}) => {
  if (!isNew && !needsRekey) {
    return null
  }

  return (
    <Box style={{width: 0, display: 'flex'}}>
      {needsRekey && (
        <Box style={rowStyles.badgeContainerRekey}>
          <Meta title="rekey" backgroundColor={Styles.globalColors.red} />
        </Box>
      )}
      {isNew && (
        <Box style={rowStyles.badgeContainerNew}>
          <Meta title="new" backgroundColor={Styles.globalColors.orange} />
        </Box>
      )}
    </Box>
  )
}

const Tlf = (props: TlfProps) => (
  <StillCommon
    itemStyles={props.itemStyles}
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
  >
    <RowMeta isNew={props.isNew} needsRekey={props.needsRekey} />
    <Box style={rowStyles.itemBox}>
      <Box2 direction="horizontal" fullWidth={true}>
        <Text
          type={props.itemStyles.textType}
          style={Styles.collapseStyles([rowStyles.rowText, {color: props.itemStyles.textColor}])}
          lineClamp={Styles.isMobile ? 1 : undefined}
        >
          {props.name}
        </Text>
      </Box2>
      {props.resetParticipants.length !== 0 && (
        <PathItemInfo resetParticipants={props.resetParticipants} isUserReset={props.isUserReset} />
      )}
    </Box>
  </StillCommon>
)

export default Tlf
