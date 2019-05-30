import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/fs'
import {rowStyles, StillCommon, StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {PathType} from '../../../constants/types/fs'

type TlfTypeProps = StillCommonProps & {
  badgeCount: number
  routePath: I.List<string>
}

const TlfType = (props: TlfTypeProps) => (
  <StillCommon
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    badge={props.badgeCount}
    routePath={props.routePath}
  >
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text
          type={Constants.pathTypeToTextType(PathType.Folder)}
          style={Styles.collapseStyles([rowStyles.rowText, {color: Constants.getPathTextColor(props.path)}])}
          lineClamp={Styles.isMobile ? 1 : undefined}
        >
          {props.name}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box>
  </StillCommon>
)

export default TlfType
