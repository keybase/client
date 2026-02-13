import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {PathItemAction, LastModifiedLine, ItemIcon, type ClickableProps} from '../common'
import {hasShare} from '../common/path-item-action/layout'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

type OwnProps = {path: T.FS.Path}

const Share = (p: ClickableProps) => {
  const {onClick, mref} = p
  return <Kb.Button key="share" label="Share" onClick={onClick} ref={mref} />
}

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const {pathItem, sfmiEnabled, _download, openPathInSystemFileManagerDesktop, fileContext} = useFSState(
    C.useShallow(s => ({
      _download: s.dispatch.download,
      fileContext: s.fileContext.get(path) || FS.emptyFileContext,
      openPathInSystemFileManagerDesktop: s.dispatch.defer.openPathInSystemFileManagerDesktop,
      pathItem: FS.getPathItem(s.pathItems, path),
      sfmiEnabled: s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled,
    }))
  )
  const download = () => {
    _download(path, 'download')
  }
  const showInSystemFileManager = () => {
    openPathInSystemFileManagerDesktop?.(path)
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
        style={styles.innerContainer}
      >
        <ItemIcon path={path} size={96} />
        <Kb.Text type="BodyBig" style={styles.filename}>
          {pathItem.name}
        </Kb.Text>
        <Kb.Text type="BodySmall">{FS.humanReadableFileSize(pathItem.size)}</Kb.Text>
        {C.isMobile && <LastModifiedLine path={path} mode="default" />}
        {pathItem.type === T.FS.PathType.Symlink && (
          <Kb.Text type="BodySmall" style={styles.symlink}>
            {'This is a symlink' + (pathItem.linkTarget ? ` to: ${pathItem.linkTarget}.` : '.')}
          </Kb.Text>
        )}
        {C.isMobile && (
          <Kb.Text center={true} type="BodySmall" style={styles.noOpenMobile}>
            This document can not be opened on mobile. You can still interact with it using the ••• menu.
          </Kb.Text>
        )}
        {
          // Enable this button for desktop when we have in-app sharing.
          hasShare('screen', path, pathItem, fileContext) && (
            <>
              <Kb.Box2 direction="vertical" gap="medium" gapStart={true} />
              <PathItemAction
                clickable={{
                  component: Share,
                  type: 'component',
                }}
                path={path}
                initView={T.FS.PathItemActionMenuView.Share}
                mode="screen"
              />
            </>
          )
        }
        {!C.isIOS &&
          (sfmiEnabled ? (
            <Kb.Button
              key="open"
              type="Dim"
              label={'Show in ' + C.fileUIName}
              style={{marginTop: Kb.Styles.globalMargins.small}}
              onClick={showInSystemFileManager}
            />
          ) : (
            <Kb.Button
              key="download"
              mode="Secondary"
              label="Download"
              style={{marginTop: Kb.Styles.globalMargins.small}}
              onClick={download}
            />
          ))}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {padding: Kb.Styles.globalMargins.medium},
        isMobile: {paddingTop: Kb.Styles.globalMargins.mediumLarge},
      }),
      filename: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.small,
      },
      innerContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          ...Kb.Styles.globalStyles.flexGrow,
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          flex: 1,
          justifyContent: 'center',
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.large,
          paddingRight: Kb.Styles.globalMargins.large,
        },
      }),
      noOpenMobile: {
        marginTop: Kb.Styles.globalMargins.medium,
      },
      symlink: {
        marginTop: Kb.Styles.globalMargins.medium,
      },
    }) as const
)

export default Container
