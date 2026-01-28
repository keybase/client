import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as Kbfs from '../common'
import Download from './download'
import {useFSState} from '@/stores/fs'

const Mobile = () => {
  Kbfs.useFsDownloadStatus()
  const downloadIDs = useFSState(s => s.downloads.regularDownloads)
  return downloadIDs.length ? (
    <>
      <Kb.Divider />
      <Kb.ScrollView horizontal={true} snapToInterval={160 + Kb.Styles.globalMargins.xtiny}>
        <Kb.Box2
          direction="horizontal"
          style={styles.box}
          centerChildren={true}
          gap="xtiny"
          gapStart={true}
          gapEnd={true}
        >
          {downloadIDs.map((downloadID, index) => (
            <Download downloadID={downloadID} key={downloadID} isFirst={index === 0} />
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </>
  ) : null
}

const Desktop = () => {
  Kbfs.useFsDownloadStatus()
  const {downloadIDs, openLocalPathInSystemFileManagerDesktop} = useFSState(
    C.useShallow(s => ({
      downloadIDs: s.downloads.regularDownloads,
      openLocalPathInSystemFileManagerDesktop: s.dispatch.defer.openLocalPathInSystemFileManagerDesktop,
    }))
  )
  const openDownloadFolder = () => openLocalPathInSystemFileManagerDesktop?.(C.downloadFolder)
  return downloadIDs.length ? (
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
        {downloadIDs.slice(0, 3).map((downloadID, index) => (
          <Download downloadID={downloadID} key={downloadID} isFirst={index === 0} />
        ))}
        {downloadIDs.length > 3 && (
          <Kb.WithTooltip tooltip="Open Downloads folder">
            <Kb.Icon
              style={styles.iconBoxEllipsis}
              type="iconfont-ellipsis"
              hint="Open downloads folder"
              color={Kb.Styles.globalColors.black_50}
              padding="tiny"
              onClick={openDownloadFolder}
            />
          </Kb.WithTooltip>
        )}
        <Kb.Box style={styles.space} />
        <Kb.WithTooltip tooltip="Open Downloads folder">
          <Kb.Icon
            type="iconfont-folder-downloads"
            hint="Open downloads folder"
            color={Kb.Styles.globalColors.black_50}
            padding="tiny"
            onClick={openDownloadFolder}
          />
        </Kb.WithTooltip>
      </Kb.Box2>
    </>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
          overflow: 'hidden',
        },
        isElectron: {height: 40},
        isMobile: {height: 48},
      }),
      iconBoxEllipsis: {
        backgroundColor: Kb.Styles.globalColors.black_10,
        borderRadius: 4,
        marginLeft: Kb.Styles.globalMargins.xtiny,
      },
      space: {flex: 1},
    }) as const
)

export default Kb.Styles.isMobile ? Mobile : Desktop
