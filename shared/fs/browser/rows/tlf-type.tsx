import * as Styles from '../../../styles'
import * as C from '../../../constants'
import * as T from '../../../constants/types'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'

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
        type={C.pathTypeToTextType(T.FS.PathType.Folder)}
        style={rowStyles.rowText}
        lineClamp={Styles.isMobile ? 1 : undefined}
      >
        {T.FS.getPathName(props.path)}
      </Kb.Text>
    }
  />
)

export default TlfType
