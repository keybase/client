# Troubleshooting the `keybase` command line

This is a list of problems that people run into frequently.

## `pinentry` doesn't work.

We use `pinentry` in situations where we need a password, but there are many
exciting ways for it to break. Here are a couple examples of what that looks
like:

```
$ keybase login
▶ INFO Forking background server with pid=2409
How would you like to sign this install of Keybase?

(1) Use an existing device
(2) Use a paper key
(3) Use my Keybase passphrase
Choose a signing option: 2
▶ ERROR GETPIN response didn't start with D; got "ERR 83918849 Permission denied <Pinentry>"
```

```
$ keybase decrypt -i my_encrypted_message
▶ ERROR GETPIN response didn't start with D; got "ERR 83918950 Inappropriate ioctl for device <Pinentry>"
```

These errors can be an interaction of several different things:

- What version of `pinentry` you have in your `PATH`. Some of them try to
  create a graphical window but fall back to the terminal. Some do only one of
  those things.
- Interesting terminal gymnastics. Running in screen or tmux can confuse the
  curses versions of `pinentry`. Depending on where you first started tmux, you
  might also end up with an invalid `DISPLAY` environment variable.
- Curious account permissions. If you log into your desktop as `userfoo`, and
  you run something like `sudo -u userbar keybase login`, that might prevent
  `pinentry` from creating windows.

One workaround for these problems is to disable pinentry, so that `keybase`
reads your password as ordinary terminal input. Use the `--pinentry` flag to do
that:

```
keybase --pinentry=none login
```

To make that configuration permanent, you can run:

```
keybase config set -b pinentry.disabled true
```
