import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {PathItemAction, LastModifiedLine, ItemIcon, type ClickableProps} from '../common'
import {hasShare} from '../common/path-item-action/layout'

type DefaultViewProps = {
  download: () => void
  sfmiEnabled: boolean
  path: T.FS.Path
  pathItem: T.FS.PathItem
  showInSystemFileManager: () => void
}

const Share = (p: ClickableProps) => <Kb.Button key="share" label="Share" onClick={p.onClick} ref={p.mref} />
const DefaultView = (props: DefaultViewProps) => {
  const fileContext = C.useFSState(s => s.fileContext.get(props.path) || C.FS.emptyFileContext)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
        style={styles.innerContainer}
      >
        <ItemIcon path={props.path} size={96} />
        <Kb.Text type="BodyBig" style={styles.filename}>
          {props.pathItem.name}
        </Kb.Text>
        <Kb.Text type="BodySmall">{C.FS.humanReadableFileSize(props.pathItem.size)}</Kb.Text>
        {C.isMobile && <LastModifiedLine path={props.path} mode="default" />}
        {props.pathItem.type === T.FS.PathType.Symlink && (
          <Kb.Text type="BodySmall" style={styles.symlink}>
            {'This is a symlink' + (props.pathItem.linkTarget ? ` to: ${props.pathItem.linkTarget}.` : '.')}
          </Kb.Text>
        )}
        {C.isMobile && (
          <Kb.Text center={true} type="BodySmall" style={styles.noOpenMobile}>
            This document can not be opened on mobile. You can still interact with it using the ••• menu.
          </Kb.Text>
        )}
        {
          // Enable this button for desktop when we have in-app sharing.
          hasShare('screen', props.path, props.pathItem, fileContext) && (
            <>
              <Kb.Box2 direction="vertical" gap="medium" gapStart={true} />
              <PathItemAction
                clickable={{
                  component: Share,
                  type: 'component',
                }}
                path={props.path}
                initView={T.FS.PathItemActionMenuView.Share}
                mode="screen"
              />
            </>
          )
        }
        {!C.isIOS &&
          (props.sfmiEnabled ? (
            <Kb.Button
              key="open"
              type="Dim"
              label={'Show in ' + C.fileUIName}
              style={{marginTop: Kb.Styles.globalMargins.small}}
              onClick={props.showInSystemFileManager}
            />
          ) : (
            <Kb.Button
              key="download"
              mode="Secondary"
              label="Download"
              style={{marginTop: Kb.Styles.globalMargins.small}}
              onClick={props.download}
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

export default DefaultView
