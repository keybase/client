package client

const teamAPIDoc = `"keybase team api" provides a JSON API to Keybase teams.

EXAMPLES:

List all your team memberships:
    {"method": "list-self-memberships"}

List memberships on one team:
    {"method": "list-team-memberships", "params": {"options": {"team": "phoenix"}}}

List memberships for a user:
    {"method": "list-user-memberships", "params": {"options": {"username": "cleo"}}}

Create a team:
    {"method": "create-team", "params": {"options": {"team": "phoenix"}}}

Add members to a team:
    {"method": "add-members", "params": {"options": {"team": "phoenix", "emails": [{"email": "alice@keybase.io", "role": "writer"}, {"email": "cleo@keybase.io", "role": "admin"}], "usernames": [{"username": "frank", "role": "reader"}, {"username": "keybaseio@twitter", "role": "writer"}]}}}

Change a member's role:
    {"method": "edit-member", "params": {"options": {"team": "phoenix", "username": "frank", "role": "writer"}}}

Remove a member:
    {"method": "remove-member", "params": {"options": {"team": "phoenix", "username": "frank"}}}

Create a subteam:
    {"method": "create-team", "params": {"options": {"team": "phoenix.bots"}}}

Rename a subteam:
    {"method": "rename-subteam", "params": {"options": {"team": "phoenix.bots", "new-team-name": "phoenix.humans"}}}

Leave a team:
    {"method": "leave-team", "params": {"options": {"team": "phoenix.humans", "permanent": true}}}

List requests to join a team:
    {"method": "list-requests", "params": {"options": {"team": "phoenix"}}}
`
