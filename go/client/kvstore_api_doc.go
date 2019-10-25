package client

const kvStoreAPIDoc = `"keybase kvstore api" provides a JSON API to fast, encrypted key-value storage. Values are encrypted with per-team-keys, but namespaces and entry keys are visible to keybase servers. This is very much a work in progress right now, and the API is subject to change.

EXAMPLES:

Get an entry (always returns the latest revision, non-existent entries have a revision of 0):
	{"method": "get", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities"}}}

Put an entry (reads value from stdin):
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
