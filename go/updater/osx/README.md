## Updater

This is an (OS X) app which shows dialog prompts for use via the command line (from the go-updater).

See keybase/prompt.go and keybase/platform_darwin for usage of this app.

### Update Prompt

The update prompt takes as input a single argument JSON string:

```json
{
    "title":       "Keybase Update: Version 1.2.3-400",
    "message":     "The version you are currently running is outdated.",
    "description": "See keybase.io for more details on this update.",
    "autoUpdate":  false
}
```

The response is a single JSON string:

```json
{
    "action": "snooze",
    "autoUpdate": false
}
```


### Generic Prompt

There is also a generic prompt which takes as input a single argument JSON string:

```json
{
    "type":    "generic",
    "title":   "Keybase Warning",
    "message": "The Keybase app is currently in use. We maybe need to interrupt current activity to perform the update",
    "buttons": ["Cancel", "Force Update"]
}
```

The response is a single JSON string (of the selected button):

```json
{
    "button": "Force Update"
}
```
