import * as Z from '@/util/zustand'
import * as T from './types'
import * as C from '.'
import * as EngineGen from '../actions/engine-gen-gen'
import {formatTimeForPopup} from '@/util/timestamp'
// import {downloadFolder} from '@/constants/platform'
import {uint8ArrayToHex} from 'uint8array-extras'

type Job = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
}

type Store = {
  jobs: Map<string, Job>
}
const initialStore: Store = {
  jobs: new Map(),
}

type State = Store & {
  dispatch: {
    onEngineIncoming: (action: EngineGen.Actions) => void
    start: (type: 'chatid' | 'chatname' | 'kbfs', path: string, outPath: string) => void
    cancel: (id: string) => void
    clearCompleted: () => void
    load: () => void
    resetState: 'default'
  }
  chatIDToDisplayname: (id: string) => string
}

export const _useState = Z.createZustand<State>(set => {
  // let startedMockTimer = false
  // const startMockTimer = () => {
  //   if (startedMockTimer) return
  //   startedMockTimer = true
  //   setInterval(() => {
  //     set(s => {
  //       for (const value of s.jobs.values()) {
  //         if (Math.random() > 0.2) {
  //           value.progress = Math.min(value.progress + Math.random() * 0.1, 1)
  //         }
  //       }
  //     })
  //   }, 1000)
  // }

  const dispatch: State['dispatch'] = {
    cancel: id => {
      // TODO
      set(s => {
        s.jobs.delete(id)
      })
    },
    clearCompleted: () => {
      // TODO
      set(s => {
        for (const [key, value] of s.jobs.entries()) {
          if (value.progress === 1) {
            s.jobs.delete(key)
          }
        }
      })
    },
    load: () => {
      // TODO
      // startMockTimer()
      // if (get().jobs.size > 0) {
      //   return
      // }
      // get().dispatch.start('chatname', '.', `${downloadFolder}/allchat`)
      // get().dispatch.start('chatname', 'keybasefriends#general', `${downloadFolder}/friends`)
      // get().dispatch.start('kbfs', '.', `${downloadFolder}/allkbfs`)
      // get().dispatch.start('kbfs', 'cnojima/vacation', `${downloadFolder}/vacation`)
      // set(s => {
      //   const old = s.jobs.get('1')
      //   if (old) {
      //     s.jobs.set('1', {
      //       ...old,
      //       progress: 0.8,
      //     })
      //   }
      // })
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.chat1NotifyChatChatArchiveComplete: {
          const {jobID} = action.payload.params
          set(s => {
            const id = uint8ArrayToHex(jobID)
            s.jobs.set(id, {
              context: 'TODO context',
              id,
              outPath: 'TODO outpath',
              progress: 1,
              started: 'TODO started',
            })
          })
          break
        }
        case EngineGen.chat1NotifyChatChatArchiveProgress: {
          const {jobID, messagesComplete, messagesTotal} = action.payload.params
          set(s => {
            const id = uint8ArrayToHex(jobID)
            s.jobs.set(id, {
              context: 'TODO context',
              id,
              outPath: 'TODO outpath',
              progress: messagesComplete / messagesTotal,
              started: 'TODO started',
            })
          })
          break
        }
        default:
      }
    },
    resetState: 'default',
    start: (type, path, outPath) => {
      const f = async () => {
        let context = ''
        switch (type) {
          case 'chatid': {
            const jobID = Uint8Array.from([...Array<number>(8)], () => Math.floor(Math.random() * 256))
            const id = uint8ArrayToHex(jobID)
            try {
              // TODO don't do this, have the service drive this
              set(s => {
                s.jobs.set(id, {
                  context,
                  id,
                  outPath,
                  progress: 0,
                  started: formatTimeForPopup(new Date().getTime()),
                })
              })
              await T.RPCChat.localArchiveChatRpcPromise({
                compress: true,
                identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
                jobID,
                outputPath: outPath,
                query: {
                  computeActiveList: false,
                  convIDs: [T.Chat.keyToConversationID(path)],
                  readOnly: false,
                  unreadOnly: false,
                },
              })
            } catch (e) {
              set(s => {
                const old = s.jobs.get(id)
                if (old) {
                  old.error = String(e)
                }
              })
            }
            return // NOTE return and not break
          }
          case 'chatname':
            // if (path === '.') {
            //   context = 'all chat'
            // } else {
            //   context = `chat/${path}`
            // }
            break
          case 'kbfs':
            if (path === '.') {
              context = 'all kbfs'
            } else {
              context = `kbfs/${path}`
            }
            break
        }
        // TODO outpath on mobile set by service
        set(s => {
          const nextKey = `${s.jobs.size + 1}`
          s.jobs.set(nextKey, {
            context,
            id: nextKey,
            outPath,
            progress: 0,
            started: formatTimeForPopup(new Date().getTime()),
          })
        })
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    chatIDToDisplayname: (conversationIDKey: string) => {
      const you = C.useCurrentUserState.getState().username
      const cs = C.getConvoState(conversationIDKey)
      const m = cs.meta
      if (m.teamname) {
        return m.teamname
      }

      const participants = cs.participants.name
      if (participants.length === 1) {
        return participants[0] ?? ''
      }
      return participants.filter(username => username !== you).join(',')
    },
    dispatch,
  }
})
