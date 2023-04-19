import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'

export type Props = {
  disableSync: () => void
  enableSync: () => void
  hideSyncToggle: boolean
  syncConfig?: Types.TlfSyncConfig | null
  waiting: boolean
}

const Confirm = (props: Props & {showingPopup: boolean; toggleShowingPopup: () => void}) => {
  const wasWaiting = React.useRef(props.waiting)
  if (wasWaiting.current !== props.waiting) {
    wasWaiting.current = props.waiting
    if (props.showingPopup) {
      props.toggleShowingPopup()
    }
  }
  return (
    <Kb.Box2 direction="vertical" style={styles.popupContainer} centerChildren={true}>
      <Kb.Text key="title" type="BodyBig">
        Unsync this folder now?
      </Kb.Text>
      <Kb.Text key="explain" type="BodySmall" center={true} style={styles.explainText}>
        This will delete your local copies of all the files in this folder.
      </Kb.Text>
      {!Styles.isMobile && (
        <Kb.Box2
          direction="horizontal"
          style={styles.popupButtonContainer}
          fullWidth={true}
          gap="xtiny"
          centerChildren={true}
        >
          <Kb.Button
            key="cancel"
            small={true}
            type="Dim"
            label="Cancel"
            onClick={props.toggleShowingPopup}
            disabled={props.waiting}
          />
          <Kb.Button
            key="yes"
            small={true}
            type="Danger"
            label="Yes, unsync"
            onClick={props.disableSync}
            disabled={props.waiting}
            waiting={props.waiting}
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const SyncToggle = (props: Props) => {
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      position="bottom left"
      closeOnSelect={false}
      containerStyle={styles.floating}
      header={<Confirm {...props} showingPopup={showingPopup} toggleShowingPopup={toggleShowingPopup} />}
      items={
        Styles.isMobile
          ? [
              {
                danger: true,
                disabled: props.waiting,
                icon: 'iconfont-cloud',
                inProgress: props.waiting,
                onClick: props.disableSync,
                style: props.waiting ? {opacity: 0.3} : undefined,
                title: props.waiting ? 'Unsyncing' : 'Yes, unsync',
              } as const,
            ]
          : []
      }
    />
  ))
  return props.syncConfig && !props.hideSyncToggle ? (
    <>
      <Kb.Switch
        align="right"
        onClick={props.syncConfig.mode === Types.TlfSyncMode.Enabled ? toggleShowingPopup : props.enableSync}
        on={props.syncConfig.mode === Types.TlfSyncMode.Enabled}
        color="green"
        label="Sync on this device"
        ref={popupAnchor}
        disabled={props.waiting}
      />
      {showingPopup && popup}
    </>
  ) : null
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      explainText: Styles.platformStyles({
        isElectron: {
          marginTop: Styles.globalMargins.xxtiny,
        },
        isMobile: {
          marginTop: Styles.globalMargins.tiny,
        },
      }),
      floating: Styles.platformStyles({
        isElectron: {
          marginTop: -38,
        },
      }),
      popupButtonContainer: {
        marginTop: Styles.globalMargins.xsmall,
      },
      popupContainer: Styles.platformStyles({
        common: {
          paddingBottom: Styles.globalMargins.small,
          paddingLeft: Styles.globalMargins.medium,
          paddingRight: Styles.globalMargins.medium,
        },
        isElectron: {
          paddingTop: Styles.globalMargins.small,
          width: 235,
        },
        isMobile: {
          paddingTop: Styles.globalMargins.large,
        },
      }),
    } as const)
)

export default SyncToggle
