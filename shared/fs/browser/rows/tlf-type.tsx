import * as Styles from '../../../styles'
import * as C from '../../../constants'
import * as Types from '../../../constants/types/fs'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {PathType} from '../../../constants/types/fs'

type TlfTypeProps = StillCommonProps

const TlfType = (props: TlfTypeProps) => (
  <StillCommon
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    writingToJournal={false}
    content={
      <Kb.Text
        fixOverdraw={true}
        type={C.pathTypeToTextType(PathType.Folder)}
        style={rowStyles.rowText}
        lineClamp={Styles.isMobile ? 1 : undefined}
      >
        {Types.getPathName(props.path)}
      </Kb.Text>
    }
  />
)

export default TlfType
