How chat works:

Conversations are of 2 basic types.
    - Small: adhoc conversations or teams with only the #general channel
    - Big: teams with multiple channels

We get a list of untrusted conversations from the server. Untrusted (unboxed) means we don't have any snippets and can't verify the participants / channel name. If we've previously loaded them the daemon can give us a trusted payload with the untrusted payload
We request untrusted conversations to be unboxed (converted to trusted). This is driven by the inbox scrolling rows into view.
The primary ID of a conversation is a ConversationIDKey. Our data structures are mostly maps driven off of this key

  badgeMap: id to the badge number
  messageMap: id to message id to message
  messageOrdinals: id to list of ordinals
  metaMap: id to metadata
  unreadMap: id to unread count

The inbox operates in 2 modes: 'normal' and 'filtered'.
Filtered is driven by a filter string. Each item calculates a score and is sorted by this score (exact match > prefix match > substring match). We show small items, then big items. No dividers or hierarchy of channel/team.
The normal mode is split into 2 sections.
1. The small rows sorted by timestamp
1. The big teams alpha sorted (first by team, then by channel)

If you have a mix of small/big teams we can show a divider between them and truncate the small list.

The inbox is entirely derived from the metaMap

Edge cases:
- Rekey: If you don't have the keys to unbox the conversation we tell you who can help you out (sometimes yourself)
- Reset users: If you have reset users in an implied team conversation (no actual team in the teams tab) we present the reset users for you to deal with.
