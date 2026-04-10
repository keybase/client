# Store Checklist

Use this file as the running checklist for the stacked cleanup series.

Status:

- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[~]` intentionally skipped for now

- [ ] `teams`
- [x] `chat`
  Notes: moved inbox search state/RPC orchestration into `shared/chat/inbox/search-state.tsx`; moved location preview coordinate state out of `shared/stores/chat.tsx`; pending create-conversation error flow now lives in chat route params instead of the chat store; moved derived inbox rows/floating-button state out of `shared/stores/chat.tsx` and into `shared/chat/inbox/use-inbox-state.tsx`.
- [ ] `push`
  Files: `shared/stores/push.desktop.tsx`, `shared/stores/push.native.tsx`, `shared/stores/push.d.ts`
- [ ] `settings-contacts`
  Files: `shared/stores/settings-contacts.desktop.tsx`, `shared/stores/settings-contacts.native.tsx`, `shared/stores/settings-contacts.d.ts`

## Notes

- Track logical stores here, not `shared/stores/tests/*`.
- `store-registry.tsx` is infrastructure, not a target store.
- This cleanup series moves linearly through the checklist by default. Take the first unchecked store unless a later note explicitly says otherwise.
