import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

type OwnProps = {
  tlfPath: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {tlfPath} = ownProps
  const {_tlfPathItem, _tlfs, setTlfSyncConfig} = useFSState(
    C.useShallow(s => ({
      _tlfPathItem: FS.getPathItem(s.pathItems, ownProps.tlfPath),
      _tlfs: s.tlfs,
      setTlfSyncConfig: s.dispatch.setTlfSyncConfig,
    }))
  )
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyFSSyncToggle)

  const enableSync = () => {
    setTlfSyncConfig(tlfPath, true)
  }
  const syncConfig = FS.getTlfFromPath(_tlfs, tlfPath).syncConfig
  // Disable sync when the TLF is empty and it's not enabled yet.
  // Band-aid fix for when new user has a non-exisitent TLF which we
  // can't enable sync for yet.
  const hideSyncToggle =
    syncConfig.mode === T.FS.TlfSyncMode.Disabled &&
    _tlfPathItem.type === T.FS.PathType.Folder &&
    !_tlfPathItem.children.size

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup, showPopup} = p
      const disableSync = () => {
        setTlfSyncConfig(tlfPath, false)
      }
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
    [waiting, setTlfSyncConfig, tlfPath]
  )
  const {showPopup, showingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return !hideSyncToggle ? (
    <>
      <Kb.Switch
        align="right"
        onClick={syncConfig.mode === T.FS.TlfSyncMode.Enabled ? showPopup : enableSync}
        on={syncConfig.mode === T.FS.TlfSyncMode.Enabled}
        color="green"
        label="Sync on this device"
        ref={popupAnchor}
        disabled={waiting}
      />
      {showingPopup && popup}
    </>
  ) : null
}

const Confirm = (props: {showPopup: () => void; disableSync: () => void; waiting: boolean}) => {
  const {showPopup, waiting, disableSync} = props
  const wasWaiting = React.useRef(waiting)
  React.useEffect(() => {
    if (wasWaiting.current !== waiting) {
      wasWaiting.current = waiting
      showPopup()
    }
  }, [waiting, showPopup])
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

export default Container
