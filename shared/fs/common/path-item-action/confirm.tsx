import * as C from '@/constants'
import * as T from '@/constants/types'
import type {FloatingMenuProps} from './types'
import * as Kb from '@/common-adapters'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  previousView: T.FS.PathItemActionMenuView
  path: T.FS.Path
  setView: (view: T.FS.PathItemActionMenuView) => void
  view: T.FS.PathItemActionMenuView
}

const Container = (ownProps: OwnProps) => {
  const {path, floatingMenuProps, previousView, setView, view} = ownProps
  const {download, size} = useFSState(
    C.useShallow(s => {
      const size = FS.getPathItem(s.pathItems, path).size
      const download = s.dispatch.download
      return {download, size}
    })
  )
  const confirm = () => {
    download(path, view === T.FS.PathItemActionMenuView.ConfirmSaveMedia ? 'saveMedia' : 'share')
    setView(previousView)
  }
  const action =
    view === T.FS.PathItemActionMenuView.ConfirmSaveMedia
      ? 'save-media'
      : 'send-to-other-app'

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
    }) as const
)

export default Container
