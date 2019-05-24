// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Flow from '../../../util/flow'
import * as Styles from '../../../styles'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {PathItemInfo, Filename} from '../../common'

type StillProps = StillCommonProps & {
  intentIfDownloading?: ?Types.DownloadIntent,
  isEmpty: boolean,
  type: Types.PathType,
}

const getDownloadingText = (intent: Types.DownloadIntent) => {
  switch (intent) {
    case 'none':
      return 'Downloading ...'
    case 'camera-roll':
      return 'Saving ...'
    case 'share':
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
    badge={props.intentIfDownloading ? 'download' : null}
    routePath={props.routePath}
  >
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Filename
          path={props.path}
          type={Constants.pathTypeToTextType(props.type)}
          style={Styles.collapseStyles([rowStyles.rowText, {color: Constants.getPathTextColor(props.path)}])}
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
        props.type !== 'folder' && <PathItemInfo path={props.path} mode="row" />
      )}
    </Kb.Box>
  </StillCommon>
)

export default Still
