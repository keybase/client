// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Constants from '../../constants/fs'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import {Box, Box2, Meta, Text} from '../../common-adapters'
import {PathItemInfo} from '../common'

type TlfProps = StillCommonProps & {
  isNew: boolean,
  needsRekey: boolean,
  needPathItemInfo: boolean,
  // We don't use this at the moment. In the future this will be used for
  // showing ignored folders when we allow user to show ignored folders in GUI.
  isIgnored: boolean,
}

const RowMeta = ({isNew, needsRekey}) => {
  if (!isNew && !needsRekey) {
    return null
  }

  return (
    <Box style={{display: 'flex', width: 0}}>
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
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
  >
    <RowMeta isNew={props.isNew} needsRekey={props.needsRekey} />
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
      {props.needPathItemInfo && <PathItemInfo path={props.path} />}
    </Box>
  </StillCommon>
)

export default Tlf
