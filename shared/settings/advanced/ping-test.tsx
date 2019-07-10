import {configGetConfigRpcPromise, metadataPingRpcPromise} from '../../constants/types/rpc-gen'
import * as Kb from '../../common-adapters'
import React, {useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo} from 'react'

function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef()

  // Store current value in ref
  useEffect(() => {
    ref.current = value
  }, [value]) // Only re-run if value changes

  // Return previous value (happens before update in useEffect above)
  return ref.current
}

export type Props = {}
export default (props: Props) => {
  const [pingRunning, setPingRunning] = useState(false)
  const [pingNumber, setPingNumber] = useState(0)

  const [pingTs, setPingTs] = useState(0)
  const [lastPingTs, setLastPingTs] = useState(0)
  const [average, setAverage] = useState(1)

  const bumpPing = () => setPingNumber(n => n + 1)

  useEffect(() => {
    pingRunning &&
      configGetConfigRpcPromise().finally(() => {
        if (pingNumber % 100 === 0) {
          const latency = Date.now() - pingTs
          if (pingNumber > 0) {
            const nCount = Math.floor(pingNumber / 100)
            setAverage(avg => (avg * (nCount - 1) + latency) / nCount)
          }
          setLastPingTs(pingTs)
          setPingTs(Date.now())
        }
        bumpPing()
      })
    return undefined
  })

  const onClick = useCallback(() => setPingRunning(!pingRunning), [pingRunning])

  return (
    <Kb.Box2 direction="vertical">
      <Kb.Button type="Default" onClick={onClick} label={`${pingRunning ? 'Stop' : 'Start'} Pinging`} />
      <Kb.Text type="Body">Ping #{pingNumber}</Kb.Text>
      <Kb.Text type="Body">Ping latency {pingTs - (lastPingTs || 0)}</Kb.Text>
      <Kb.Text type="Body">Average {average}</Kb.Text>
    </Kb.Box2>
  )
}
