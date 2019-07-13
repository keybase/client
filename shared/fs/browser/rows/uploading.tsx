import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import {rowStyles} from './common'
import * as Kb from '../../../common-adapters'
import {Filename, PathItemIcon} from '../../common'

type UploadingProps = {
  path: Types.Path
  type: Types.PathType
  errorRetry?: (() => void)| null
  writingToJournal: boolean
  syncing: boolean
}

const getStatusText = ({writingToJournal, syncing}: UploadingProps): string => {
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
  <Kb.ListItem2
    type="Small"
    firstItem={true /* we add divider in Rows */}
    icon={
      <PathItemIcon
        path={props.path}
        size={32}
        style={Styles.collapseStyles([rowStyles.pathItemIcon, styles.opacity30])}
        badge={Types.PathItemBadgeType.Upload}
      />
    }
    body={
      <Kb.Box key="main" style={rowStyles.itemBox}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Filename
            path={props.path}
            type={Constants.pathTypeToTextType(props.type)}
            style={rowStyles.rowText_30}
          />
        </Kb.Box2>
        {props.errorRetry ? (
          <Kb.Text type="BodySmall" style={styles.textFailed}>
            Upload has failed.{' '}
            <Kb.Text type="BodySmall" onClick={props.errorRetry} underline={true} style={styles.textFailed}>
              Retry
            </Kb.Text>
          </Kb.Text>
        ) : (
          <Kb.Meta title={getStatusText(props)} backgroundColor={Styles.globalColors.blue} />
        )}
      </Kb.Box>
    }
  />
)

const styles = Styles.styleSheetCreate({
  opacity30: {
    opacity: 0.3,
  },
  textFailed: {
    color: Styles.globalColors.redDark,
  },
})

export default Uploading
