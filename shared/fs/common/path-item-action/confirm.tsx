import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import {FloatingMenuProps} from './types'

export type Props = {
  confirm: (() => void) | 'disabled'
  floatingMenuProps: FloatingMenuProps
  action: 'save-media' | 'send-to-other-app'
  path: Types.Path
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
        ? `You are about to download a ${Constants.humanReadableFileSize(props.size)} file.`
        : `The file will be downloaded and its size is ${Constants.humanReadableFileSize(props.size)}.`}
    </Kb.Text>
  </Kb.Box2>
)

export default (props: Props) => (
  <Kb.FloatingMenu
    closeOnSelect={false}
    closeText="Cancel"
    containerStyle={props.floatingMenuProps.containerStyle}
    attachTo={props.floatingMenuProps.attachTo}
    visible={props.floatingMenuProps.visible}
    onHidden={props.floatingMenuProps.hideOnce}
    position="bottom right"
    header={{
      title: 'unused',
      view: <ConfirmHeader {...props} />,
    }}
    items={
      props.confirm
        ? [
            {
              disabled: props.confirm === 'disabled',
              onClick: props.confirm !== 'disabled' ? props.confirm : undefined,
              title: 'Yes, continue',
            },
          ]
        : []
    }
  />
)

const styles = Styles.styleSheetCreate({
  confirmText: {
    textAlign: 'center',
  },
  confirmTextBox: {
    padding: Styles.globalMargins.medium,
  },
  menuRowText: {
    color: Styles.globalColors.blueDark,
  },
  menuRowTextDisabled: {
    color: Styles.globalColors.blueDark,
    opacity: 0.6,
  },
  progressIndicator: {
    marginRight: Styles.globalMargins.xtiny,
  },
})
