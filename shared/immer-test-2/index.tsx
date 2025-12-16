import * as React from 'react'
import {useStore} from './store'

const serializeForDisplay = (value: unknown): unknown => {
  if (value instanceof Set) {
    return Array.from(value).map(serializeForDisplay)
  }
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {}
    for (const [key, val] of value.entries()) {
      obj[String(key)] = serializeForDisplay(val)
    }
    return obj
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      obj[key] = serializeForDisplay(val)
    }
    return obj
  }
  if (Array.isArray(value)) {
    return value.map(serializeForDisplay)
  }
  return value
}

const TestApp = () => {
  const toggleLocalReaction = useStore(s => s.toggleLocalReaction)
  const message = useStore(s => s.messageMap.get(1))

  const handleClick = () => {
    const targetOrdinal = 1
    toggleLocalReaction({
      decorated: ':+1:',
      emoji: '+1',
      targetOrdinal,
      username: 'testuser',
    })
  }

  return (
    <div>
      <button onClick={handleClick}>Toggle Reaction</button>
      <pre>{JSON.stringify(serializeForDisplay(message), null, 2)}</pre>
    </div>
  )
}

export default TestApp
