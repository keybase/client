// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {rowStyles} from './common'
import * as Kb from '../../common-adapters'
import {PathItemIcon} from '../common'

type UploadingProps = {
  path: Types.Path,
  type: Types.PathType,
  error: boolean,
  writingToJournal: boolean,
  syncing: boolean,
}

const getStatusText = ({error, writingToJournal, syncing}: UploadingProps): string => {
  if (error) {
    return 'Upload error'
  }
  if (writingToJournal && syncing) {
    return 'Encrypting & Uploading'
  }
  if (writingToJournal) {
    return 'Encrypting'
  }
  if (syncing) {
    return 'Uploading'
  }
  return 'Done'
}

const Uploading = (props: UploadingProps) => (
  <Kb.Box style={rowStyles.rowBox}>
    <PathItemIcon path={props.path} size={32} style={rowStyles.pathItemIcon_30} badge="upload" />
    <Kb.Box key="main" style={rowStyles.itemBox}>
      <Kb.Text
        type={Constants.pathTypeToTextType(props.type)}
        style={Styles.collapseStyles([rowStyles.rowText_30, {color: Constants.getPathTextColor(props.path)}])}
        lineClamp={Styles.isMobile ? 1 : undefined}
      >
        {Types.getPathName(props.path)}
      </Kb.Text>
      <Kb.Meta
        title={getStatusText(props)}
        backgroundColor={props.error ? Styles.globalColors.red : Styles.globalColors.blue}
      />
    </Kb.Box>
  </Kb.Box>
)

export default Uploading
