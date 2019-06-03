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

Send a message:
    {"method": "send", "params": {"options": {"channel": {"name": "you,them"}, "message": {"body": "is it cold today?"}}}}

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

Load a flip's result:
    {"method": "loadflip", "params": {"options": {"conversation_id": "...", "flip_conversation_id": "...", "msg_id": 72, "game_id": "..."}}}

Get unfurl settings:
    {"method": "getunfurlsettings"}

Set unfurl setings (thumbnails for sent links):
    {"method": "setunfurlsettings", "params": {"options":{"mode": "always/never/whitelisted", "whitelist":["example.com"]}}}
`
