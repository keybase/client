// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors, styleSheetCreate} from '../../styles'
import {Box2, Box, Icon, ClickableBox, WithTooltip} from '../../common-adapters'
import Download from './download-container'

export type DownloadsProps = {
  downloadKeys: Array<string>,
  thereAreMore: boolean,
  openDownloadFolder?: () => void,
}

const Downloads = (props: DownloadsProps) =>
  !!props.downloadKeys.length && (
    <Box2 direction="horizontal" fullWidth={true} style={styles.box}>
      <Box style={styles.downloadsBox}>
        {props.downloadKeys.map(key => (
          <Download downloadKey={key} key={key} />
        ))}
      </Box>
      <Box style={styles.buttonsBox}>
        {props.thereAreMore ? (
          <WithTooltip text="Open Downloads folder">
            <ClickableBox style={styles.iconBoxEllipsis} onClick={props.openDownloadFolder}>
              <Icon type="iconfont-ellipsis" hint="Open downloads folder" color={globalColors.black_40} />
            </ClickableBox>
          </WithTooltip>
        ) : (
          <Box /> /* have a box here to make space-between work */
        )}
        <WithTooltip text="Open Downloads folder">
          <ClickableBox style={styles.iconBoxOpenDownload} onClick={props.openDownloadFolder}>
            <Icon
              type="iconfont-folder-downloads"
              hint="Open downloads folder"
              color={globalColors.black_40}
            />
          </ClickableBox>
        </WithTooltip>
      </Box>
    </Box2>
  )

const styles = styleSheetCreate({
  box: {
    height: 40,
    backgroundColor: globalColors.blue5,
    borderStyle: 'solid',
    borderTopWidth: 1,
    borderTopColor: globalColors.black_10,
  },
  iconBoxOpenDownload: {
    padding: globalMargins.tiny,
  },
  iconBoxEllipsis: {
    padding: globalMargins.tiny,
    backgroundColor: globalColors.black_10,
    borderRadius: 4,
    marginLeft: globalMargins.xtiny,
  },
  downloadsBox: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
  },
  buttonsBox: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.flexGrow,
    minWidth: globalMargins.xtiny + 32 + globalMargins.tiny + 32 + globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})

export default Downloads
