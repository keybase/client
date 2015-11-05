## Electron Architecture

The Electron app is a single long-running "shim" process, which has three
features -- pinentry, tracker popups, and OS notifications.

When the app is started, it shows a launcher that allows manual testing of
each component, and connects to a service over RPC.  The service never has
to know how to launch or contact the client: the client connects over RPC,
and the server issues calls to the connected client.

### Pinentry

The service instructs us that it requires pinentry over RPC.  It includes a
JSON blob detailing what it wants us to ask.  In response to the RPC, we
launch a dialog window, and reply to the RPC with the user input we received.

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
  "secret": "my_s3kr1t",
  "secret_storage": true
}
```

The window that the Electron app opens in response to the RPC should render a
"smart" React component which interprets the JSON, and passes values through
to a "dumb" React component inside our codebase as props.  This avoids having
to e.g. update our CSS styles in two different places when we want to change
something.

Open questions:
* Should the service be able to start the GUI client if it's not running?
  (MVP suggested answer: no)
* Should the service replay missed notifications to a client that connects,
  if the notification was generated while there was no client connected?
  (MVP suggested answer: no)

### Tracker popups

There's some old discussion of how this RPC conversation might look
[here](https://github.com/keybase/client/issues/530), and the Keybase service
already has a notion of clients registering to receive notifications, as well
as of "Ui" endpoints that the service can instantiate over RPC to obtain
user input.

I don't know what the Ui protocol for tracker popups looks like in detail --
we should ask the Core team to share a finalized version with us soon.

### KBFS errors and OS notifications

When a KBFS write fails, or conflict happens, or over-quota occurs, etc, we want
to notify the user.   We can either use the [Chromium Desktop Notifications API](https://www.chromium.org/developers/design-documents/desktop-notifications)
from Electron, or an NPM module that performs native OS notifications such as
[node-notifier](https://github.com/mikaelbr/node-notifier).

To subscribe to notifications we call `keybase.1.notifyCtl.toggleNotifications`.
After that, we'll receive messages like `keybase.1.NotifySession.loggedOut` and
can convert them into OS notifications.  There will in the near future be a
`keybase.1.NotifyKBFS.*` (or similar) hierarchy for us, though it doesn't exist
yet.

### Menubar

Instead of just showing a dialog that lets you choose features to manually run,
the "shim" app could do that in an OS menubar, though this isn't necessary for
MVP.  An example of an Electron app that sits in the menubar and waits for an
event before showing itself is this emoji keyboard,
[mojibar](https://github.com/muan/mojibar).

In the case of mojibar, it
[registers a global handler](https://github.com/muan/mojibar/blob/master/index.js#L71)
for ctrl+shift+space and shows a window when that handler fires; in our case, we
register for an RPC, and create a new Electron window when that handler fires.
