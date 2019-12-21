package client

const contactSettingsAPIDoc = `"keybase contact-settings api" provides a JSON API to manage contact settings.

EXAMPLES:

Get contact settings:
	{"method": "get"}

Put contact settings:
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": true, "teams": []}}}}
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": false, "teams": []}}}}

Put contact settings with team-based settings:
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": true,"teams": [{"team_name": acme, "enabled": true }, {"team_name": nadir, "enabled": false}]}}}}
	{"method": "set", "params": {"options": {"settings": {"allow_followee_degrees": 1, "allow_good_teams": false, "enabled": true,"teams": [{"team_name": acme, "enabled": true }]}}}}
`
