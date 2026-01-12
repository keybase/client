import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import type {FloatingMenuProps} from './types'
import * as Kb from '@/common-adapters'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {path, floatingMenuProps} = ownProps
  const {_pathItemActionMenu, size, setPathItemActionMenuView, download} = useFSState(
    C.useShallow(s => {
      const _pathItemActionMenu = s.pathItemActionMenu
      const size = FS.getPathItem(s.pathItems, path).size
      const setPathItemActionMenuView = s.dispatch.setPathItemActionMenuView
      const download = s.dispatch.download
      return {_pathItemActionMenu, download, setPathItemActionMenuView, size}
    })
  )
  const _confirm = React.useCallback(
    ({view, previousView}: typeof _pathItemActionMenu) => {
      download(path, view === T.FS.PathItemActionMenuView.ConfirmSaveMedia ? 'saveMedia' : 'share')
      setPathItemActionMenuView(previousView)
    },
    [setPathItemActionMenuView, download, path]
  )
  const action =
    _pathItemActionMenu.view === T.FS.PathItemActionMenuView.ConfirmSaveMedia
      ? 'save-media'
      : 'send-to-other-app'

  const confirm = () => _confirm(_pathItemActionMenu)

  return (
    <Kb.FloatingMenu
      closeOnSelect={false}
      closeText="Cancel"
      containerStyle={floatingMenuProps.containerStyle}
      attachTo={floatingMenuProps.attachTo}
      visible={floatingMenuProps.visible}
      onHidden={floatingMenuProps.hide}
      position="bottom right"
      header={<ConfirmHeader size={size} action={action} />}
      items={[
        {
          disabled: false,
          icon: 'iconfont-check',
          onClick: confirm,
          title: 'Yes, continue',
        },
      ]}
    />
  )
}

const ConfirmHeader = (props: {action: 'save-media' | 'send-to-other-app'; size: number}) => (
  <Kb.Box2
    style={styles.confirmTextBox}
    direction="vertical"
    fullWidth={true}
    centerChildren={true}
    gap="small"
  >
    <Kb.Text type="Header" style={styles.confirmText}>
      Continue to {props.action === 'save-media' ? 'save' : 'share'}?
    </Kb.Text>
    <Kb.Text type="Body" style={styles.confirmText}>
      {props.action === 'save-media'
        ? `You are about to download a ${FS.humanReadableFileSize(props.size)} file.`
        : `The file will be downloaded and its size is ${FS.humanReadableFileSize(props.size)}.`}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      confirmText: {
        textAlign: 'center',
      },
      confirmTextBox: {
        padding: Kb.Styles.globalMargins.medium,
      },
      menuRowText: {
        color: Kb.Styles.globalColors.blueDark,
      },
      menuRowTextDisabled: {
        color: Kb.Styles.globalColors.blueDark,
        opacity: 0.6,
      },
      progressIndicator: {
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export default Container
