import logger from '@/logger'
import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import {clientID as fsClientID, makeUUID} from './client'
import {useFsConnectionGeneration, useKbfsDaemonStatus} from './daemon'
import {useFsErrorActionOrThrow} from './error-state'

export const filesTabBadgeToUploadIcon = (badge: T.RPCGen.FilesTabBadge): T.FS.UploadIcon | undefined => {
  switch (badge) {
    case T.RPCGen.FilesTabBadge.awaitingUpload:
      return T.FS.UploadIcon.AwaitingToUpload
    case T.RPCGen.FilesTabBadge.uploadingStuck:
      return T.FS.UploadIcon.UploadingStuck
    case T.RPCGen.FilesTabBadge.uploading:
      return T.FS.UploadIcon.Uploading
    case T.RPCGen.FilesTabBadge.none:
      return undefined
  }
}

const fetchUploadIcon = async (
  generation: number,
  generationRef: React.RefObject<number>,
  connectedRef: React.RefObject<boolean>,
  setUploadIcon: (icon: T.FS.UploadIcon | undefined) => void
) => {
  try {
    const badge = await T.RPCGen.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
    if (generation === generationRef.current && connectedRef.current) {
      setUploadIcon(filesTabBadgeToUploadIcon(badge))
    }
  } catch {
    // Retry once; see HOTPOT-1226.
    try {
      const badge = await T.RPCGen.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
      if (generation === generationRef.current && connectedRef.current) {
        setUploadIcon(filesTabBadgeToUploadIcon(badge))
      }
    } catch {}
  }
}

export const useFilesTabUploadIcon = () => {
  const connected = useKbfsDaemonStatus().rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected
  const connectionGeneration = useFsConnectionGeneration()
  const connectedRef = React.useRef(connected)
  const generationRef = React.useRef(0)
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const [uploadIcon, setUploadIcon] = React.useState<T.FS.UploadIcon | undefined>(undefined)
  React.useLayoutEffect(() => {
    connectedRef.current = connected
  }, [connected])
  const onError = React.useEffectEvent((error: unknown) => {
    errorToActionOrThrow(error)
  })
  const loadUploadIcon = React.useEffectEvent(() => {
    if (!connectedRef.current) {
      return
    }
    const generation = ++generationRef.current
    C.ignorePromise(fetchUploadIcon(generation, generationRef, connectedRef, setUploadIcon))
  })
  const [stableLoadUploadIcon] = React.useState(() => () => {
    loadUploadIcon()
  })

  C.Router2.useSafeFocusEffect(stableLoadUploadIcon)

  React.useEffect(() => {
    if (!connected) {
      // drops a read still in flight from before the disconnect
      generationRef.current++
      return
    }
    if (connectionGeneration === undefined) {
      return
    }
    let current = true
    const subscriptionID = makeUUID()
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
          clientID: fsClientID,
          deduplicateIntervalSecond: 1,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
          topic: T.RPCGen.SubscriptionTopic.filesTabBadge,
        })
      } catch (error) {
        try {
          onError(error)
        } catch (thrown) {
          logger.warn('files tab badge subscribe failed:', thrown)
        }
      }
      // Read once the service holds the subscription (or failed to): a change before then sent no
      // notification
      if (current) {
        loadUploadIcon()
      }
    }
    C.ignorePromise(f())
    return () => {
      current = false
      C.ignorePromise(
        T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
          clientID: fsClientID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
        }).catch(() => {})
      )
    }
  }, [connected, connectionGeneration])

  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotify',
    action => {
      const {clientID, topic} = action.payload.params
      if (clientID === fsClientID && topic === T.RPCGen.SubscriptionTopic.filesTabBadge) {
        loadUploadIcon()
      }
    },
    connected
  )

  return connected ? uploadIcon : undefined
}
