import * as React from 'react'
import {useStore} from './store'

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
      <p>{JSON.stringify(message, null, 2)}</p>
    </div>
  )
}

export default TestApp
