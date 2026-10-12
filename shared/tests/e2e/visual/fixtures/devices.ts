// Device last-used times: the service updates them whenever a device is used, so they move between
// a base and a check. Each device's time is rewritten relative to the frozen clock, in device ID
// order, so the list reads the same however the devices were really used.
import type * as T from '@/constants/types'
import {transform, type FixtureDef} from './def.ts'

const hour = 60 * 60 * 1000
// minutes, hours, days and months ago, so every relative-time format shows
const agos = [5 * 60 * 1000, 3 * hour, 4 * 24 * hour, 70 * 24 * hour]

const rewrite = (list: ReadonlyArray<T.RPCGen.DeviceDetail> | null, now: number) => {
  if (!list) return list
  const order = [...list].map(d => d.device.deviceID).sort()
  return list.map(d => {
    const i = order.indexOf(d.device.deviceID)
    const ago = agos[i % agos.length]! * (1 + Math.floor(i / agos.length))
    return {...d, device: {...d.device, lastUsedTime: now - ago}}
  })
}

export const deviceLastUsed: FixtureDef = {
  rpc: [transform('keybase.1.device.deviceHistoryList', (list, _param, ctx) => rewrite(list, ctx.now), {required: true})],
  teardown: 'remount',
}
