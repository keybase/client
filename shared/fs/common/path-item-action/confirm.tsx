import type * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type {FloatingMenuProps} from './types'

export type Props = {
  confirm: (() => void) | 'disabled'
  floatingMenuProps: FloatingMenuProps
  action: 'save-media' | 'send-to-other-app'
  path: T.FS.Path
  size: number
}

const ConfirmHeader = (props: Props) => (
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
        ? `You are about to download a ${C.FS.humanReadableFileSize(props.size)} file.`
        : `The file will be downloaded and its size is ${C.FS.humanReadableFileSize(props.size)}.`}
    </Kb.Text>
  </Kb.Box2>
)

const PathItemActionConfirm = (props: Props) => (
  <Kb.FloatingMenu
    closeOnSelect={false}
    closeText="Cancel"
    containerStyle={props.floatingMenuProps.containerStyle}
    attachTo={props.floatingMenuProps.attachTo}
    visible={props.floatingMenuProps.visible}
    onHidden={props.floatingMenuProps.hide}
    position="bottom right"
    header={<ConfirmHeader {...props} />}
    items={[
      {
        disabled: props.confirm === 'disabled',
        icon: 'iconfont-check',
        onClick: props.confirm !== 'disabled' ? props.confirm : undefined,
        title: 'Yes, continue',
      },
    ]}
  />
)
export default PathItemActionConfirm

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
