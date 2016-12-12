package client

const chatAPIDoc = `"keybase chat api" provides a JSON API to the Keybase chat service.

EXAMPLES:

List inbox:
    {"method": "list"}

Read a conversation:
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}}}}

Send a message:
    {"method": "send", "params": {"options": {"channel": {"name": "you,them"}, "message": {"body": "is it cold today?"}}}

Delete a message:
    {"method": "delete", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 314}}}

Edit a message:
    {"method": "edit", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 314, "message": {"body": "new content"}}}}

Upload an attachment:
    {"method": "attach", "params": {"options": {"channel": {"name": "you,them"}, "filename": "photo.jpg", "title": "Sunset last night"}}}

Download an attachment:
    {"method": "download", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 59, "output": "/tmp/movie.mp4"}}}

Peek into a conversation (doesn't mark messages as read):
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}}, "peek": true}}

Get unread messages only, and just peek at them:
    {"method": "read", "params": {"options": {"channel": {"name": "you,them"}}, "unread_only": true, "peek": true}}

Mark a conversation as read up to a specific message:
    {"method": "mark", "params": {"options": {"channel": {"name": "you,them"}, "message_id": 72}}}

List inbox by topic type:
    {"method": "list", "params": {"options": {"topic_type": "DEV"}}}

Send a message to a public channel:
    {"method": "send", "params": {"options": {"channel": {"name": "you", "public": true}, "message": {"body": "Still going..."}}}}

Ignore a conversation:
    {"method": "setstatus", "params": {"options": {"channel": {"name": "you,them"}, "status": "ignored"}}}
`
