## Electron Architecture

The Electron app (here in `client/desktop/`) is a single long-running "shim"
process, which has three features for our first MVP release -- pinentry, tracker
popups, and OS notifications.

When the app is started, it adds an icon to your OS menubar, and connects to a
Keybase service (`client/go/`) over RPC. The service never has to know how to
launch or contact the client: the client connects over RPC, and client<->server
can then issue calls against each other.

### Pinentry

The service instructs us that it requires a user's Keybase passphrase over RPC.
It includes a JSON blob detailing what it wants us to ask. In response to the
RPC, we launch a dialog window, and reply to the RPC with the user input we
received.

Example JSON blob from the service:

```js
{
  "window_title": "Keybase",
  "prompt_text": "Please enter your passphrase to unlock your private key",
  "features": {
    "secret_storage": {
      "allow": true,
      "label": "Store my secret"
    },
    ...
  }
}
```

Example JSON reply to the service:

```js
{
  "passphrase": "my_s3kr1t",
  "secret_storage": true
}
```

The window that the Electron app opens in response to the RPC renders a "smart"
React component which interprets the JSON, and passes values through to a "dumb"
React component (currently at `shared/pinentry/index.render.desktop.js`) as
props. This lets us render the "dumb" component standalone for testing, too.

Open questions:

- Should the service be able to start the GUI client if it's not running?
  (MVP answer: no)
- Should the service replay missed notifications to a client that connects,
  if the notification was generated while there was no client connected?
  (MVP answer: no)

### Tracker popups

We can register as a delegated identify UI with the Go core, and it'll send us
any identity or proof updates, which we can show and update in real-time in a
tracker popup window (files in `shared/tracker/`). We create a new tracker popup
window in response to KBFS operations like cd'ing into a new private directory.

### KBFS errors and OS notifications

When a KBFS write fails, or conflict happens, or over-quota occurs, etc, we want
to notify the user. We're using the Electron implementation of the [Chromium Desktop Notifications API](https://www.chromium.org/developers/design-documents/desktop-notifications).

There are also activity notifications, just to let the user know that KBFS
really is doing encryption and uploading for them. These arrive to us from a
KBFS notification stream on the service, and we rate-limit them and decide
what to show.
