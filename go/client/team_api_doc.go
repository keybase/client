package client

const teamAPIDoc = `"keybase team api" provides a JSON API to Keybase teams.

EXAMPLES:

List all your team memberships:
    {"method": "list-self-memberships"}

Add members to a team:
    {"method": "add-members", "params": {"options": {"team": "treehouse", "emails": [{"email": "alice@treehouse.org", "role": "writer"}, {"email": "cleo@treehose.hor", "role": "admin"}], "usernames": [{"username": "frank", "role": "reader"}, {"username": "keybaseio@twitter", "role": "writer"}]}}}

`
