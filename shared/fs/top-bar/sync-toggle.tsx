import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

export type Props = {
  disableSync: () => void
  enableSync: () => void
  hideSyncToggle: boolean
  syncConfig?: T.FS.TlfSyncConfig
  waiting: boolean
}

const Confirm = (props: Pick<Props, 'waiting' | 'disableSync'> & {showPopup: () => void}) => {
  const {showPopup, waiting, disableSync} = props
  const wasWaiting = React.useRef(waiting)
  if (wasWaiting.current !== waiting) {
    wasWaiting.current = waiting
    showPopup()
  }
  return (
    <Kb.Box2 direction="vertical" style={styles.popupContainer} centerChildren={true}>
      <Kb.Text key="title" type="BodyBig">
        Unsync this folder now?
      </Kb.Text>
      <Kb.Text key="explain" type="BodySmall" center={true} style={styles.explainText}>
        This will delete your local copies of all the files in this folder.
      </Kb.Text>
      {!Kb.Styles.isMobile && (
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
            onClick={showPopup}
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
      const {attachTo, hidePopup, showPopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={hidePopup}
          position="bottom left"
          closeOnSelect={false}
          containerStyle={styles.floating}
          header={<Confirm waiting={waiting} disableSync={disableSync} showPopup={showPopup} />}
          items={
            Kb.Styles.isMobile
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
  const {showPopup, showingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return props.syncConfig && !props.hideSyncToggle ? (
    <>
      <Kb.Switch
        align="right"
        onClick={props.syncConfig.mode === T.FS.TlfSyncMode.Enabled ? showPopup : props.enableSync}
        on={props.syncConfig.mode === T.FS.TlfSyncMode.Enabled}
        color="green"
        label="Sync on this device"
        ref={popupAnchor}
        disabled={props.waiting}
      />
      {showingPopup && popup}
    </>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      explainText: Kb.Styles.platformStyles({
        isElectron: {
          marginTop: Kb.Styles.globalMargins.xxtiny,
        },
        isMobile: {
          marginTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      floating: Kb.Styles.platformStyles({
        isElectron: {
          marginTop: -38,
        },
      }),
      popupButtonContainer: {
        marginTop: Kb.Styles.globalMargins.xsmall,
      },
      popupContainer: Kb.Styles.platformStyles({
        common: {
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingLeft: Kb.Styles.globalMargins.medium,
          paddingRight: Kb.Styles.globalMargins.medium,
        },
        isElectron: {
          paddingTop: Kb.Styles.globalMargins.small,
          width: 235,
        },
        isMobile: {
          paddingTop: Kb.Styles.globalMargins.large,
        },
      }),
    }) as const
)

export default SyncToggle
