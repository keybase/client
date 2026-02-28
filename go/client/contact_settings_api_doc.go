package client

const contactSettingsAPIDoc = `"keybase contact-settings api" provides a JSON API to manage contact settings.

EXAMPLES:

Get contact settings:
	{"method": "get"}

Set contact settings on, only allowing users to message me if I follow them:
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": true, "teams": []}}}}

Set contact settings on, only allowing users to message me if I follow them or I follow someone who follows them:
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 2, "allow_good_teams": false, "enabled": true, "teams": []}}}}

Set contact settings on, only allowing users to message me if I follow them, and if they are in the team 'acme' with me
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": true, "enabled": true, "teams": [{"team_name": "acme", "enabled": true}, {"team_name": "nadir", "enabled": false}]}}}}
`
