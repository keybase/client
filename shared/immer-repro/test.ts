import {ZStore} from './store'

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

const testToggleReaction = () => {
  console.log('Test: Toggle reaction on/off')
  const store = new ZStore()

  const ordinal = 1
  const emoji = '👍'
  const username = 'alice'
  const decorated = '👍'

  store.setMessage(ordinal, {
    reactions: new Map(),
  })

  const getReactionUsers = () => {
    const message = store.getState().messageMap.get(ordinal)
    return message?.reactions?.get(emoji)?.users ?? new Set()
  }

  const getReactionCount = () => {
    return getReactionUsers().size
  }

  assert(getReactionCount() === 0, 'Initial reaction count should be 0')

  store.toggleLocalReaction({
    decorated,
    emoji,
    targetOrdinal: ordinal,
    username,
  })

  assert(getReactionCount() === 1, 'After first toggle, reaction count should be 1')
  const users1 = getReactionUsers()
  assert(users1.size === 1, 'Users set should have 1 element')
  const firstReaction = Array.from(users1)[0]
  assert(firstReaction.username === username, 'First reaction should have correct username')

  store.toggleLocalReaction({
    decorated,
    emoji,
    targetOrdinal: ordinal,
    username,
  })

  const countAfterSecond = getReactionCount()
  console.log(`Reaction count after second toggle: ${countAfterSecond}`)
  console.log(`Expected: 0 (reaction should be removed)`)
  
  if (countAfterSecond !== 0) {
    console.error('BUG REPRODUCED: Reaction was not removed on second toggle!')
    console.error(`Actual count: ${countAfterSecond}`)
    const users = getReactionUsers()
    console.error(`Users in set: ${Array.from(users).map(u => u.username).join(', ')}`)
  } else {
    console.log('Reaction correctly removed on second toggle')
  }

  store.toggleLocalReaction({
    decorated,
    emoji,
    targetOrdinal: ordinal,
    username,
  })

  const countAfterThird = getReactionCount()
  console.log(`Reaction count after third toggle: ${countAfterThird}`)
  console.log(`Expected: 1 (reaction should be added back)`)
  
  if (countAfterThird !== 1) {
    console.error('BUG REPRODUCED: Reaction was not added back on third toggle!')
    console.error(`Actual count: ${countAfterThird}`)
  } else {
    console.log('Reaction correctly added back on third toggle')
  }
}

const testMultipleToggles = () => {
  console.log('\nTest: Multiple rapid toggles')
  const store = new ZStore()

  const ordinal = 2
  const emoji = '❤️'
  const username = 'bob'
  const decorated = '❤️'

  store.setMessage(ordinal, {
    reactions: new Map(),
  })

  const getReactionCount = () => {
    const message = store.getState().messageMap.get(ordinal)
    return message?.reactions?.get(emoji)?.users?.size ?? 0
  }

  for (let i = 0; i < 5; i++) {
    store.toggleLocalReaction({
      decorated,
      emoji,
      targetOrdinal: ordinal,
      username,
    })
    const count = getReactionCount()
    const expected = i % 2 === 0 ? 1 : 0
    console.log(`Toggle ${i + 1}: count=${count}, expected=${expected}`)
    
    if (count !== expected) {
      console.error(`BUG REPRODUCED at toggle ${i + 1}: expected ${expected}, got ${count}`)
    }
  }
}

const runTests = () => {
  try {
    testToggleReaction()
    testMultipleToggles()
    console.log('\nAll tests completed')
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

runTests()

