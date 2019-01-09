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
              <Icon type="iconfont-ellipsis" hint="Open downloads folder" color={globalColors.black_50} />
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
              color={globalColors.black_50}
            />
          </ClickableBox>
        </WithTooltip>
      </Box>
    </Box2>
  )

const styles = styleSheetCreate({
  box: {
    backgroundColor: globalColors.blue5,
    borderStyle: 'solid',
    borderTopColor: globalColors.black_10,
    borderTopWidth: 1,
    height: 40,
  },
  buttonsBox: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.flexGrow,
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: globalMargins.xtiny + 32 + globalMargins.tiny + 32 + globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  downloadsBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  iconBoxEllipsis: {
    backgroundColor: globalColors.black_10,
    borderRadius: 4,
    marginLeft: globalMargins.xtiny,
    padding: globalMargins.tiny,
  },
  iconBoxOpenDownload: {
    padding: globalMargins.tiny,
  },
})

export default Downloads
