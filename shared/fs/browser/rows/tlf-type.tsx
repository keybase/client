import * as React from 'react'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/fs'
import {rowStyles, StillCommon, StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {PathType} from '../../../constants/types/fs'

type TlfTypeProps = StillCommonProps & {
  badgeCount: number
}

const TlfType = (props: TlfTypeProps) => (
  <StillCommon
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    badge={props.badgeCount}
  >
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text
          type={Constants.pathTypeToTextType(PathType.Folder)}
          style={rowStyles.rowText}
          lineClamp={Styles.isMobile ? 1 : undefined}
        >
          {props.name}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box>
  </StillCommon>
)

export default TlfType
