// @flow
// RPC stats. Not keeping this in redux so we don't get any thrashing

const _stats = {
  in: {},
  out: {},
}

export const gotStat = (method: string, incoming: boolean, payloadSize: number = 0) => {
  const inKey = incoming ? 'in' : 'out'
  if (!_stats[inKey][method]) {
    _stats[inKey][method] = {
      count: 0,
      payloadSize: 0,
    }
  }

  const i = _stats[inKey][method]
  i.count++
  i.lastCall = Date.now()
  i.payloadSize += payloadSize
}

export const getStats = () => _stats
