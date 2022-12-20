import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Kbfs from '../common'
import Download from './download'
import {downloadFolder} from '../../constants/platform'

const Mobile = () => {
  Kbfs.useFsDownloadStatus()
  const downloadIDs = Container.useSelector(state => state.fs.downloads.regularDownloads)
  return downloadIDs.length ? (
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
  const downloadIDs = Container.useSelector(state => state.fs.downloads.regularDownloads)
  const dispatch = Container.useDispatch()
  const openDownloadFolder = () =>
    dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadFolder}))
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
              color={Styles.globalColors.black_50}
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
            color={Styles.globalColors.black_50}
            padding="tiny"
            onClick={openDownloadFolder}
          />
        </Kb.WithTooltip>
      </Kb.Box2>
    </>
  ) : null
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)

export default Styles.isMobile ? Mobile : Desktop
