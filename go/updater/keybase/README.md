## Keybase

Keybase specific behavior for updates.

### Environment

To change delay (how often check occurs, 1m = 1 minute, 1h = 1 hour):
```
launchctl setenv KEYBASE_UPDATER_DELAY 1m
```

To make the updater always apply an update after a check (even if same version):
```
launchctl setenv KEYBASE_UPDATER_FORCE true
```

Then restart the updater:
```
keybase launchd restart keybase.updater
```
