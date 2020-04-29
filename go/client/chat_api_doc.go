package client

const chatAPIDoc = `"keybase chat api" provides a JSON API to the Keybase chat service.

EXAMPLES:

List inbox:
    {"method": "list"}

Read a conversation:
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}}}}

Read a conversation (paginated):
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}, "pagination": {"num": 10}}}}

Then, in the reply, check the result.pagination object, which has a next,
previous, and last field. If last is false and you want the second page,

    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}, "pagination": {"next": "<result.pagination.next from reply>", "num": 10}}}}

If you're on the nth page and want to go back, set the previous field instead.

    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}, "pagination": {"previous": "<result.pagination.previous from last reply>", "num": 10}}}}

Get specific messages:
    {"method": "get", "params": {"options": {"channel": {"name": "you,them"}, "message_ids": [314, 315, 342]}}}

Send a message:
    {"method": "send", "params": {"options": {"channel": {"name": "you,them"}, "message": {"body": "is it cold today?"}}}}

Send a reply:
   {"method": "send", "params": {"options": {"channel": {"name": "you,them"}, "message": {"body": "is it cold today?"}, "reply_to": 314}}}

Delete a message:
    {"method": "delete", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 314}}}

Edit a message:
    {"method": "edit", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 314, "message": {"body": "new content"}}}}

React to a message:
    {"method": "reaction", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 314, "message": {"body": ":+1:"}}}}

Upload an attachment:
    {"method": "attach", "params": {"options": {"channel": {"name": "you,them"}, "filename": "photo.jpg", "title": "Sunset last night"}}}

Download an attachment:
    {"method": "download", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 59, "output": "/tmp/movie.mp4"}}}

Peek into a conversation (doesn't mark messages as read):
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}, "peek": true}}}

Get unread messages only, and just peek at them:
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}, "unread_only": true, "peek": true}}}

Mark a conversation as read up to a specific message:
    {"method": "mark", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 72}}}

List inbox by topic type:
    {"method": "list", "params": {"options": {"topic_type": "DEV"}}}

Send a message to a public channel:
    {"method": "send", "params": {"options": {"channel": {"name": "you", "public": true}, "message": {"body": "Still going..."}}}}

Mute a conversation:
    {"method": "setstatus", "params": {"options": {"channel": {"name": "you,them"}, "status": "muted"}}}

Search the inbox:
    {"method": "searchinbox", "params": {"options": {"query": "hi", "sent_by": "them", "sent_to": "you", "max_hits": 1000, "sent_after":"09/10/2017"}}}

Search conversation with a regex:
    {"method": "searchregexp", "params": {"options": {"channel": {"name": "you,them"}, "query": "a.*", "is_regex": true, "sent_by": "them", "sent_to": "you", "sent_before":"09/10/2017"}}}

Read a team conversation:
    {"method": "read", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "general"}}}}

Read a team conversation channel:
    {"method": "read", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "meetings"}}}}

Send a message to a team conversation channel:
    {"method": "send", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}, "message": {"body": "time for lunch?"}}}}

Create a new blank conversation:
    {"method": "newconv", "params": {"options": {"channel": {"name": "you,them"}}}}

List conversations on a name:
    {"method": "listconvsonname", "params": {"options": {"topic_type": "CHAT", "members_type": "team", "name": "treehouse"}}}

Join a team conversation:
    {"method": "join", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}}}}

Leave a team conversation:
    {"method": "leave", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}}}}

Add one or more users to a team conversation:
    {"method": "addtochannel", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}, "usernames": ["alice", "bob", "charlie"]}}}

Load a flip's result:
    {"method": "loadflip", "params": {"options": {"conversation_id": "...", "flip_conversation_id": "...", "msg_id": 72, "game_id": "..."}}}

Get unfurl settings:
    {"method": "getunfurlsettings"}

Set unfurl settings (thumbnails for sent links):
    {"method": "setunfurlsettings", "params": {"options":{"mode": "always/never/whitelisted", "whitelist":["example.com"]}}}

Advertise available bot commands in the UI:
    {"method": "advertisecommands", "params": {"options":{"alias": "helpbot", "advertisements":[{"type": "public", "commands": [{"name": "help", "description": "Get help using this bot"}]}]}}}
Note the following are valid values for "type": "public", "teammembers", "teamconvs", "conv":
    - public: Commands are publicly viewable by all users.
    - teammembers: Commands are listed to members of the team in any conversation they are in. "team_name" must be specified.
    - teamconvs:  Commands are listed in all conversations of the given team. "team_name" must be specified.
    - conv: Commands are listed to the given conversation. "conv_id" must be specified.

Clear bot commands:
    {"method": "clearcommands"}
Note that there is an optional filter for this method. The valid values for "type" are "public", "teammembers", "teamconvs", "conv":
    {"method": "clearcommands", "params": {"options": {"filter": {"type": "teamconvs", "team_name": "treehouse"}}}}

List bot commands for a conversation:
    {"method": "listcommands", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}}}}

Pin a message to a chat:
   {"method": "pin", "params": {"options": {"message_id": 5, "channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}}}}

Unpin the message of chat:
   {"method": "unpin", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}}}}

Get a user's device info from their username:
   {"method": "getdeviceinfo", "params": {"options": {"username": "cjb"}}}

Get all reset members of conversations in your inbox:
   {"method": "getresetconvmembers"}

Re-add a reset user back to a conversation:
   {"method": "addresetconvmember", "params": {"options": {"username": "joshblum", "conversation_id": "..."}}}

List members of a conversation from a topic name:
   {"method": "listmembers", "params": {"options": {"channel": {"name": "treehouse", "members_type": "team", "topic_name": "random"}}}}

List members of a conversation from a conversation id:
   {"method": "listmembers", "params": {"options": {"conversation_id": "..."}}}

Add an emoji:
    {"method": "emojiadd", "params": {"options": {"channel": {"name": "mikem"}, "alias": "mask-parrot2", "filename": "/Users/mike/Downloads/mask-parrot.gif"}}}

Add an emoji alias:
    {"method": "emojiaddalias", "params": {"options": {"channel": {"name": "mikem"}, "new_alias": "mask-parrot2", "existing_alias": "mask-parrot"}}}

Remove an emoji:
    {"method": "emojiremove", "params": {"options": {"channel": {"name": "mikem"}, "alias": "mask-parrot2"}}}

List emojis available to send:
    {"method": "emojilist"}'
`
