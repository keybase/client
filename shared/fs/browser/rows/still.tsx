import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Flow from '../../../util/flow'
import * as Styles from '../../../styles'
import {rowStyles, StillCommon, StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {PathItemInfo, Filename} from '../../common'

type StillProps = StillCommonProps & {
  intentIfDownloading?: Types.DownloadIntent | null
  isEmpty: boolean
  type: Types.PathType
}

const getDownloadingText = (intent: Types.DownloadIntent) => {
  switch (intent) {
    case Types.DownloadIntent.None:
      return 'Downloading ...'
    case Types.DownloadIntent.CameraRoll:
      return 'Saving ...'
    case Types.DownloadIntent.Share:
      return 'Preparing to send to other app ...'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
      return ''
  }
}

const Still = (props: StillProps) => (
  <StillCommon
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    badge={props.intentIfDownloading ? Types.PathItemBadgeType.Download : null}
  >
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Filename
          path={props.path}
          type={Constants.pathTypeToTextType(props.type)}
          style={rowStyles.rowText}
        />
        {props.isEmpty && (
          <Kb.Meta
            title="empty"
            backgroundColor={Styles.globalColors.greyDark}
            style={{marginLeft: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.xxtiny}}
          />
        )}
      </Kb.Box2>
      {props.intentIfDownloading ? (
        <Kb.Text type="BodySmall">{getDownloadingText(props.intentIfDownloading)}</Kb.Text>
      ) : (
        props.type !== Types.PathType.Folder && <PathItemInfo path={props.path} mode="row" />
      )}
    </Kb.Box>
  </StillCommon>
)

export default Still
