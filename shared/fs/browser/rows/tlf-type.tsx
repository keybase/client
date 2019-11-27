import * as React from 'react'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import {rowStyles, StillCommon, StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {PathType} from '../../../constants/types/fs'

type TlfTypeProps = StillCommonProps

const TlfType = (props: TlfTypeProps) => (
  <StillCommon
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    writingToJournal={false}
  >
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text
          type={Constants.pathTypeToTextType(PathType.Folder)}
          style={rowStyles.rowText}
          lineClamp={Styles.isMobile ? 1 : undefined}
        >
          {Types.getPathName(props.path)}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box>
  </StillCommon>
)

export default TlfType
