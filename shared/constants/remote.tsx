// helper only used in remote windows on electron
import KB2 from '@/util/electron.desktop'
import type * as RemoteGen from './remote-actions'
const {mainWindowDispatch} = KB2.functions

export const remoteDispatch = (a: RemoteGen.Actions) => {
  mainWindowDispatch(a)
}
