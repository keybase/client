import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import * as FS from '@/stores/fs'
import {useFsErrorActionOrThrow} from './error-state'

const filesTabBadgeToUploadIcon = (badge: T.RPCGen.FilesTabBadge): T.FS.UploadIcon | undefined => {
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

export const useFilesTabUploadIcon = () => {
  const connected = FS.useFSState(s => s.kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected)
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
    const f = async () => {
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
    C.ignorePromise(f())
  })
  const [stableLoadUploadIcon] = React.useState(() => () => {
    loadUploadIcon()
  })

  React.useEffect(() => {
    if (!connected) {
      generationRef.current++
      setUploadIcon(undefined)
      return
    }
    loadUploadIcon()
  }, [connected])
  C.Router2.useSafeFocusEffect(stableLoadUploadIcon)

  React.useEffect(() => {
    if (!connected) {
      return
    }
    const subscriptionID = FS.makeUUID()
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
          clientID: FS.clientID,
          deduplicateIntervalSecond: 1,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
          topic: T.RPCGen.SubscriptionTopic.filesTabBadge,
        })
      } catch (error) {
        onError(error)
      }
    }
    C.ignorePromise(f())
    return () => {
      C.ignorePromise(
        T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
          clientID: FS.clientID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
        }).catch(() => {})
      )
    }
  }, [connected])

  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotify',
    action => {
      const {clientID, topic} = action.payload.params
      if (clientID === FS.clientID && topic === T.RPCGen.SubscriptionTopic.filesTabBadge) {
        loadUploadIcon()
      }
    },
    connected
  )

  return uploadIcon
}
