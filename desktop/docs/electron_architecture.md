## Electron Architecture

### Pinentry

Pinentry will be handled separately from the other desktop MVP features, through
a new `electron-password` application, which:

1. reads JSON instructions on stdin until EOF
1. spawns a single window
1. inside that window, renders HTML from a given path (which can include JS)
1. prints the user input it received as JSON to stdout
1. exits

Example stdin:
```js
{
  "html_path": "/usr/local/share/keybase/desktop/templates/password.html",
  "window_title": "Keybase",
  "prompt_text": "Please enter your passphrase to unlock your private key",
  "checkbox": true,
  "checkbox_text": "Store my passphrase",
}
```

Example stdout:
```js
{
  "password": "my_s3kr1t",
  "checkbox_ticked": false
}
```

There's nothing Keybase-specific about this application other than the HTML we
will choose to point it at.  We could publish it as a totally separate NPM
module.  We will bundle it as a binary with our installer.  The Go service will
spawn `electron-password` as a child process.

We're choosing to split this out from the rest of the code because it's closer
to the existing pinentry APIs that way, and there are some (perhaps falsely
reassuring) security arguments in favor of having a smaller process that
performs a simple task with no network access or general RPC mechanism. Also,
hooking stdin and stdout through to Electron is a pretty weird thing, and this
way keeps that weirdness separated from the main app.

https://github.com/dominictarr/electro is an example of using stdin/stdout with
Electron.

We would like the HTML we point `electron-password` at to render a dumb React
component from our main codebase.  This avoids having to e.g. update our CSS
styles in two different places when we want to change something.  But it means
that the service will have to know something about where the GUI client's data
lives so that it can pass in the `html_path` parameter.  Can we think of a way
around that?

### Menubar "shim" app

When someone runs the main Keybase.app, all that they should see is a new
menubar icon for Keybase appear -- no windows created on launch by default.

We could present a debug screen when they click on the menubar: it could show
whether they are connected to a service, whether KBFS is mounted, and general
status info.  (The menubar icon is mainly to aid developers and beta testers in
debugging -- we could imagine removing it for production to avoid cluttering
everyone's menubar.)

On launch, this app connects to a Keybase service via RPC, and advertises
itself as being able to handle user notifications on behalf of the service.

So the direction of the information flow is that the client will start up and
connect to a service, then the service will perform RPCs against that client.
This means the service never has to know anything about how to locate or contact
a GUI client.

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
as of"Ui" endpoints that the service can instantiate over RPC to obtain
user input.  Keywords:
[NotifyRouter, SetChannels, ToggleNotifications](https://github.com/keybase/client/blob/f1da498b176bcfe5793eedb6893f6f2c5890ba76/go/service/notify.go)

I don't know what the Ui protocol for tracker popups looks like in detail --
we should ask the Core team to share a finalized version with us soon.

An example of an Electron app that sits in the menubar and waits for an event
before showing itself is this emoji keyboard,
[mojibar](https://github.com/muan/mojibar):

![mojibar gif](https://cloud.githubusercontent.com/assets/1153134/8794765/1c246d46-2fb9-11e5-9429-560fa1192b4f.gif)

In the case of mojibar, it
[registers a global handler](https://github.com/muan/mojibar/blob/master/index.js#L71)
for ctrl+shift+space and shows a window when that handler fires; in our case, we
register for an RPC, and create a new Electron window when that handler fires.

### KBFS errors and OS notifications

When a KBFS write fails, or conflict happens, or over-quota occurs, etc, we want
to notify the user.  It's not clear that the Electron stack needs to be involved
in this at all, though.  If there's a good cross-platform OS notification
library for Golang, the Go service could just perform the notification itself.
Is there one?

If not, perhaps we *do* want to get involved for that reason, and could use the
[Chromium Desktop Notifications API](https://www.chromium.org/developers/design-documents/desktop-notifications)
from Electron, or an NPM module that performs native OS notifications such as [node-notifier](https://github.com/mikaelbr/node-notifier).
