import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'

export type Props = {
  disableSync: () => void
  enableSync: () => void
  hideSyncToggle: boolean
  syncConfig?: Types.TlfSyncConfig
  waiting: boolean
}

const Confirm = (props: Pick<Props, 'waiting' | 'disableSync'> & {toggleShowingPopup: () => void}) => {
  const {toggleShowingPopup, waiting, disableSync} = props
  const wasWaiting = React.useRef(waiting)
  if (wasWaiting.current !== waiting) {
    wasWaiting.current = waiting
    toggleShowingPopup()
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
            onClick={toggleShowingPopup}
            disabled={waiting}
          />
          <Kb.Button
            key="yes"
            small={true}
            type="Danger"
            label="Yes, unsync"
            onClick={disableSync}
            disabled={waiting}
            waiting={waiting}
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const SyncToggle = (props: Props) => {
  const {waiting, disableSync} = props
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={toggleShowingPopup}
          position="bottom left"
          closeOnSelect={false}
          containerStyle={styles.floating}
          header={
            <Confirm waiting={waiting} disableSync={disableSync} toggleShowingPopup={toggleShowingPopup} />
          }
          items={
            Styles.isMobile
              ? [
                  {
                    danger: true,
                    disabled: waiting,
                    icon: 'iconfont-cloud',
                    inProgress: waiting,
                    onClick: disableSync,
                    style: waiting ? {opacity: 0.3} : undefined,
                    title: waiting ? 'Unsyncing' : 'Yes, unsync',
                  } as const,
                ]
              : []
          }
        />
      )
    },
    [disableSync, waiting]
  )
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
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
