import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Download from './download-container'

export type DownloadsProps = {
  downloadKeys: Array<string>
  openDownloadFolder?: () => void
}

const Mobile = (props: DownloadsProps) =>
  props.downloadKeys.length ? (
    <>
      <Kb.Divider />
      <Kb.ScrollView horizontal={true} snapToInterval={160 + Styles.globalMargins.xtiny}>
        <Kb.Box2
          direction="horizontal"
          style={styles.box}
          centerChildren={true}
          gap="xtiny"
          gapStart={true}
          gapEnd={true}
        >
          {props.downloadKeys.map((key, index) => (
            <Download downloadKey={key} key={key} isFirst={index === 0} />
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </>
  ) : null

const Desktop = (props: DownloadsProps) =>
  props.downloadKeys.length ? (
    <>
      <Kb.Divider />
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={styles.box}
        gap="xtiny"
        gapStart={true}
        gapEnd={true}
        centerChildren={true}
      >
        {props.downloadKeys.slice(0, 3).map((key, index) => (
          <Download downloadKey={key} key={key} isFirst={index === 0} />
        ))}
        {props.downloadKeys.length > 3 && (
          <Kb.WithTooltip text="Open Downloads folder">
            <Kb.Icon
              style={styles.iconBoxEllipsis}
              type="iconfont-ellipsis"
              hint="Open downloads folder"
              color={Styles.globalColors.black_50}
              padding="tiny"
              onClick={props.openDownloadFolder}
            />
          </Kb.WithTooltip>
        )}
        <Kb.Box style={styles.space} />
        <Kb.WithTooltip text="Open Downloads folder">
          <Kb.Icon
            type="iconfont-folder-downloads"
            hint="Open downloads folder"
            color={Styles.globalColors.black_50}
            padding="tiny"
            onClick={props.openDownloadFolder}
          />
        </Kb.WithTooltip>
      </Kb.Box2>
    </>
  ) : null

const styles = Styles.styleSheetCreate({
  box: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueLighter3,
      overflow: 'hidden',
    },
    isElectron: {height: 40},
    isMobile: {height: 48},
  }),
  iconBoxEllipsis: {
    backgroundColor: Styles.globalColors.black_10,
    borderRadius: 4,
    marginLeft: Styles.globalMargins.xtiny,
  },
  space: {flex: 1},
})

export default (Styles.isMobile ? Mobile : Desktop)
