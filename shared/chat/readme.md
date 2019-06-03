How chat works:

## Inbox:

Conversations are of 2 basic types. - Small: adhoc conversations or teams with only the #general channel - Big: teams with multiple channels

We get a list of untrusted conversations from the server. Untrusted (unboxed) means we don't have any snippets and can't verify the participants / channel name. If we've previously loaded them the daemon can give us a trusted payload with the untrusted payload
We request untrusted conversations to be unboxed (converted to trusted). This is driven by the inbox scrolling rows into view.
The primary ID of a conversation is a ConversationIDKey. Our data structures are mostly maps driven off of this key

badgeMap: id to the badge number
messageMap: id to message id to message
messageOrdinals: id to list of ordinals
metaMap: id to metadata
unreadMap: id to unread count
etc

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

## Thread

A conversation thread is a list of messages. The thread itself is just a list of ids and each row is individually connected.
Messages have several IDs associated with them and they're used in different circumstances.

MessageID: is the true id of a sent message. This is used as input to rpcs (like editing/deleting)
OutboxID: is used when sending a message (while in the grey state)
Ordinal: is used to order / lookup messages. Ordinals are currently fractional additions to the last visible message id.
If i sent a message after the already sent {MessageID: 123} the oridinal would be 123.001
The ordinal is only used to ensure this client is seeing messages in order from their perspective. If you reload the thread those ordinals can be resolved into their real sent ids (aka 123.001 -> 124)
We keep the original ordinal if we can so the ordering of the thread from our perspective is static, even if the 'real' order is different. This means if you reload 123.001 -> 124 but during the session it will remain 123.001

## Pending

When we build a search for users we want to preview the conversation. We have a special conversationIDKey for this Constants.pendingConversationIDKey. This always exists in the metaMap. The users go into the participants property. Usually the convesationIDKey inside the meta is the same as the key in the metaMap but in this special instance the key of the preview conversation goes in there depending on the participants
