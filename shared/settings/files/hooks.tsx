import {defaultNotificationThreshold} from '.'
import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import {clientID as fsClientID, useFSState} from '@/stores/fs'

type FilesSettings = {
  isLoading: boolean
  spaceAvailableNotificationThreshold: number
  syncOnCellular: boolean
}

const useFiles = () => {
  const [settings, setSettings] = React.useState<FilesSettings>(() => ({
    isLoading: true,
    spaceAvailableNotificationThreshold: 0,
    syncOnCellular: false,
  }))
  const loadSettings = React.useEffectEvent(async () => {
    setSettings(s => ({...s, isLoading: true}))
    try {
      const next = await T.RPCGen.SimpleFSSimpleFSSettingsRpcPromise()
      setSettings({
        isLoading: false,
        spaceAvailableNotificationThreshold: next.spaceAvailableNotificationThreshold,
        syncOnCellular: next.syncOnCellular,
      })
    } catch {
      setSettings(s => ({...s, isLoading: false}))
    }
  })
  const refreshGlobalSettings = React.useEffectEvent(() => {
    useFSState.getState().dispatch.loadSettings()
  })

  React.useEffect(() => {
    C.ignorePromise(loadSettings())
  }, [])

  useEngineActionListener('keybase.1.NotifyFS.FSSubscriptionNotify', action => {
    const {clientID, topic} = action.payload.params
    if (clientID === fsClientID && topic === T.RPCGen.SubscriptionTopic.settings) {
      C.ignorePromise(loadSettings())
    }
  })

  const setSpaceAvailableNotificationThreshold = (threshold: number) => {
    const f = async () => {
      setSettings(s => ({...s, isLoading: true}))
      try {
        await T.RPCGen.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({threshold})
        await loadSettings()
        refreshGlobalSettings()
      } catch {
        setSettings(s => ({...s, isLoading: false}))
      }
    }
    C.ignorePromise(f())
  }
  const setSyncOnCellular = (syncOnCellular: boolean) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSSetSyncOnCellularRpcPromise(
          {syncOnCellular},
          C.waitingKeyFSSetSyncOnCellular
        )
        await loadSettings()
        refreshGlobalSettings()
      } catch {}
    }
    C.ignorePromise(f())
  }

  const onDisableSyncNotifications = () => {
    setSpaceAvailableNotificationThreshold(0)
  }
  return {
    areSettingsLoading: settings.isLoading,
    onDisableSyncNotifications,
    onEnableSyncNotifications: () => setSpaceAvailableNotificationThreshold(defaultNotificationThreshold),
    setSpaceAvailableNotificationThreshold,
    setSyncOnCellular,
    spaceAvailableNotificationThreshold: settings.spaceAvailableNotificationThreshold,
    syncOnCellular: settings.syncOnCellular,
  }
}

export default useFiles
