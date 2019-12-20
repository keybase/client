package client

const contactSettingsAPIDoc = `"keybase contact-settings api" provides a JSON API to manage contact settings.

EXAMPLES:

Get contact settings:
	{"method": "get"}

Put contact settings:
	{"method": "put", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": true, "teams": []}}}}

Put contact settings with team-based settings:
	{"method": "put", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": true,"teams": [{"team_id": <team_id>, "enabled": true}]}}}}
`
