// @flow
// RPC stats. Not keeping this in redux so we don't get any thrashing

const _stats = {
  in: {},
  out: {},
  eof: 0,
}

export const gotStat = (method: string, incoming: boolean) => {
  const inKey = incoming ? 'in' : 'out'
  if (!_stats[inKey][method]) {
    _stats[inKey][method] = {
      count: 0,
    }
  }

  const i = _stats[inKey][method]
  i.count++
}

export const gotEOF = () => {
  ++_stats.eof
}

export const getStats = () => _stats
