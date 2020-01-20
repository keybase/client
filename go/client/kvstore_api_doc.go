package client

const kvStoreAPIDoc = `"keybase kvstore api" provides a JSON API to fast, encrypted key-value storage. The "entryKey" and "namespace" fields are visible to the Keybase servers, "entryValue" is encrypted with the per-team-key. This is still a bit of a work in progress.

If team is not included or is "", then the command defaults to using the signed-in user's implicit self-team (only your user can see and decrypt this).

EXAMPLES:

Get an entry (always returns the latest revision, non-existent entries have a revision of 0):
	{"method": "get", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities"}}}

Put an entry in your implicit self-team; if you want to write out the team name:
	{"method": "put", "params": {"options": {"team": "yourusername,yourusername", "namespace": "pw-manager", "entryKey": "geocities", "entryValue": "all my secrets"}}}

,..or leave "team" empty (""), or don't include team field:
	{"method": "put", "params": {"options": {"namespace": "pw-manager", "entryKey": "geocities", "entryValue": "all my secrets"}}}

Put an encrypted entry for anyone in team phoenix:
	{"method": "put", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities", "entryValue": "all my secrets"}}}

Put an entry (specifying a non-zero revision enables custom concurrency behavior, e.g. 1 will throw an error if the entry already exists):
	{"method": "put", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities", "revision": 1, "entryValue": "all my secrets"}}}

List all namespaces with a non-deleted entryKey (pagination not yet implemented for >10k items):
	{"method": "list", "params": {"options": {"team": "phoenix"}}}

List all non-deleted entryKeys in a namespace (pagination not yet implemented for >10k items):
	{"method": "list", "params": {"options": {"team": "phoenix", "namespace": "pw-manager"}}}

Delete an entry:
	{"method": "del", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities"}}}

Delete an entry (also supports specifying the revision):
	{"method": "del", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "revision": 4, "entryKey": "geocities"}}}
`
