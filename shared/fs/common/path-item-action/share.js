// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import type {FloatingMenuProps} from './types'
import Header from './header-container'

type Props = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  shouldHideMenu: boolean,
  // Menu items
  saveMedia?: (() => void) | 'in-progress',
  shareNative?: (() => void) | 'in-progress',
|}

const InProgressMenuEntry = ({text}) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Text type="BodyBig" style={styles.menuRowTextDisabled}>
      {text}
    </Kb.Text>
    <Kb.ProgressIndicator style={styles.progressIndicator} />
  </Kb.Box2>
)
const ActionableMenuEntry = ({text}) => (
  <Kb.Text type="BodyBig" style={styles.menuRowText}>
    {text}
  </Kb.Text>
)

const makeMenuItems = (props: Props) => [
  ...(props.saveMedia
    ? [
        {
          disabled: props.saveMedia === 'in-progress',
          onClick: props.saveMedia !== 'in-progress' ? props.saveMedia : undefined,
          title: 'Save',
          view:
            props.saveMedia === 'in-progress' ? (
              <InProgressMenuEntry text="Save" />
            ) : (
              <ActionableMenuEntry text="Save" />
            ),
        },
      ]
    : []),
  ...(props.shareNative
    ? [
        {
          disabled: props.shareNative === 'in-progress',
          onClick: props.shareNative !== 'in-progress' ? props.shareNative : undefined,
          title: 'Send to other app',
          view:
            props.shareNative === 'in-progress' ? (
              <InProgressMenuEntry text="Send to other app" />
            ) : (
              <ActionableMenuEntry text="Send to other app" />
            ),
        },
      ]
    : []),
]

export default (props: Props) => {
  props.shouldHideMenu && props.floatingMenuProps.hideOnce()
  return (
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
        view: <Header path={props.path} />,
      }}
      items={makeMenuItems(props)}
    />
  )
}

const styles = Styles.styleSheetCreate({
  menuRowText: {
    color: Styles.globalColors.blue,
  },
  menuRowTextDisabled: {
    color: Styles.globalColors.blue,
    opacity: 0.6,
  },
  progressIndicator: {
    bottom: 0,
    left: 0,
    marginRight: Styles.globalMargins.xtiny,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
