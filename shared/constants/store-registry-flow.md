# Store Registry Call Flow

## Example: Teams → Chat `previewConversation`

### Before (Direct Call)
```typescript
// teams/index.tsx
import {useChatState} from '../chat2'  // ❌ Circular dependency

const {previewConversation} = C.useChatState.getState().dispatch
previewConversation({
  channelname,
  conversationIDKey: newConversationIDKey,
  reason: 'newChannel',
  teamname,
})
```

### After (Registry Call)
```typescript
// teams/index.tsx
import {storeRegistry} from '../store-registry'  // ✅ No circular dependency

storeRegistry.call('chat', 'previewConversation', {
  channelname,
  conversationIDKey: newConversationIDKey,
  reason: 'newChannel',
  teamname,
})
```

## Flow Diagram

```
1. teams/index.tsx calls:
   storeRegistry.call('chat', 'previewConversation', {...args})

2. store-registry.ts:
   - Receives: storeName='chat', actionName='previewConversation', args
   - TypeScript validates: actionName exists on chat.dispatch, args match Parameters
   
3. getStoreState('chat'):
   - Lazy require: const {useChatState} = require('./chat2')
   - Gets state: useChatState.getState()
   - Returns: ChatType.State
   
4. Call action:
   - state.dispatch['previewConversation'](...args)
   - Executes chat store's previewConversation method
   
5. Return:
   - Returns whatever previewConversation returns (void in this case)
```

## Type Safety Flow

```
storeRegistry.call('chat', 'previewConversation', {...})
     ↓
TypeScript checks:
  - 'chat' is valid StoreName ✓
  - 'previewConversation' exists on chat.dispatch ✓
  - {...} matches Parameters<chat.dispatch.previewConversation> ✓
     ↓
Runtime:
  - Lazy loads chat store (only when called)
  - Calls the action with correct args
  - Returns typed result
```

## Lazy Loading Benefits

- **Before**: `import {useChatState}` loads chat store immediately when teams module loads
- **After**: `require('./chat2')` only loads chat store when `call()` is executed
- **Result**: Chat store not loaded until actually needed (code splitting preserved)

