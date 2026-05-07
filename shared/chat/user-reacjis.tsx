import * as C from '@/constants'
import * as T from '@/constants/types'
import {ensureError} from '@/util/errors'
import {useDaemonState} from '@/stores/daemon'

const defaultTopReacjis: ReadonlyArray<T.RPCGen.UserReacji> = [
  {name: ':+1:'},
  {name: ':-1:'},
  {name: ':tada:'},
  {name: ':joy:'},
  {name: ':sunglasses:'},
]
const defaultSkinTone = T.RPCGen.ReacjiSkinTone.skintone1

const toTopReacjis = (userReacjis?: T.RPCGen.UserReacjis) =>
  userReacjis?.topReacjis?.filter(r => /^:[^:]+:$/.test(r.name)) ?? defaultTopReacjis

const toSkinTone = (userReacjis?: T.RPCGen.UserReacjis) => userReacjis?.skinTone ?? defaultSkinTone

export const useTopReacjis = () =>
  useDaemonState(C.useShallow(s => toTopReacjis(s.bootstrapStatus?.userReacjis)))

export const useReactionRowTopReacjis = () =>
  useDaemonState(
    C.useShallow(s => {
      const topReacjis = toTopReacjis(s.bootstrapStatus?.userReacjis)
      return [topReacjis[0], topReacjis[1], topReacjis[2], topReacjis[3], topReacjis[4]]
    })
  ).filter((reacji): reacji is T.RPCGen.UserReacji => !!reacji)

export const useCurrentSkinTone = () =>
  T.Chat.EmojiSkinToneFromRPC(useDaemonState(s => toSkinTone(s.bootstrapStatus?.userReacjis)))

export const useSetSkinTone = () => {
  const rpc = C.useRPC(T.RPCChat.localPutReacjiSkinToneRpcPromise)
  const updateUserReacjis = useDaemonState(s => s.dispatch.updateUserReacjis)
  return (emojiSkinTone: undefined | T.Chat.EmojiSkinTone) => {
    rpc(
      [{skinTone: T.Chat.EmojiSkinToneToRPC(emojiSkinTone)}],
      res => updateUserReacjis(res),
      err => {
        throw ensureError(err)
      }
    )
  }
}
