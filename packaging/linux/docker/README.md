# Keybase Docker distribution

## Supported tags and respective `Dockerfile` links

- [the "standard" image](https://github.com/keybase/client/blob/master/packaging/linux/docker/standard/Dockerfile)
- [the "slim" variant](https://github.com/keybase/client/blob/master/packaging/linux/docker/slim/Dockerfile)
- [the "alpine" image](https://github.com/keybase/client/blob/master/packaging/linux/docker/alpine/Dockerfile)
- [the "alpine-slim" variant](https://github.com/keybase/client/blob/master/packaging/linux/docker/alpine-slim/Dockerfile)
- [the "node" variant (standard image based on an LTS release of Node)](https://github.com/keybase/client/blob/master/packaging/linux/docker/node/Dockerfile)
- [the "node-slim" variant (slim image based on an LTS release of Node)](https://github.com/keybase/client/blob/master/packaging/linux/docker/node-slim/Dockerfile)
- [the "python" variant (standard image based on Python 3.8)](https://github.com/keybase/client/blob/master/packaging/linux/docker/python/Dockerfile)
- [the "python-slim" variant (slim image based on Python 3.8)](https://github.com/keybase/client/blob/master/packaging/linux/docker/python-slim/Dockerfile)

## Quick reference

- **Where to get help**:
  [the keybasefriends team on Keybase](https://keybase.io/team/keybasefriends), [the community-run mkbot team on keybase](https://keybase.io/team/mkbot)

- **Where to file issues**:
  [https://github.com/keybase/client](https://github.com/keybase/client)

- **Where to find a changelog**:
  [packaging/linux/docker/README.md](https://github.com/keybase/client/blob/master/packaging/linux/docker/README.md)

- **Supported architectures**:
  Currently we only support amd64, please file a ticket if you'd like us to
  support other architectures!

## What is Keybase?

Keybase is a key directory that maps social media identities to encryption keys
(including, but not limited to PGP keys) in a publicly auditable manner.
Keybase offers an end-to-end encrypted chat and cloud storage system,
called Keybase Chat and the Keybase filesystem respectively. Files placed in
the public portion of the filesystem are served from a public endpoint, as well
as locally from a filesystem mounted by the Keybase client.

> [wikipedia.org/wiki/Keybase](https://en.wikipedia.org/wiki/Keybase)

![logo](https://keybase.io/images/icons/icon-keybase-logo-64@2x.png)

## How to use this image?

### Environment variables

- `KEYBASE_SERVICE` - if it's passed OR there are no commands started, a service
  gets started up by the entrypoint,
- `KEYBASE_USERNAME` and `KEYBASE_PAPERKEY` - if both of these env variables are
  passed _and_ `KEYBASE_SERVICE` is passed / there is no command passed, the
  service automatically logs in as the paper key in oneshot mode.
- `KEYBASE_SERVICE_ARGS` - args passed during service startup, `-debug` by default.
- `KEYBASE_KBFS_ARGS` (unsupported in `slim`) - args passed during KBFS startup, `-debug -mount-type=none` by default.
- `KEYBASE_LOG_SERVICE_TO_STDOUT` - prints out the service logs to stdout. Automatically enabled if no command was passed.
- `KEYBASE_LOG_KBFS_TO_STDOUT` (unsupported in `slim`) - prints out the KBFS logs to stdout. Automatically enabled if no command was passed.

### start a keybase service

```console
$ docker run --name some-keybase -d keybaseio/client
```

### run commands against a running keybase service

```console
$ docker run --rm -it --volumes-from some-keybase keybaseio/client keybase login
```

### run a bash bot that sends a command to a user after startup

bot.sh
```bash
#!/usr/bin/env bash
MSG="sending at $(date)"
keybase chat send $CHAT_TARGET "$MSG"
```

Dockerfile
```dockerfile
FROM keybaseio/client
ENV KEYBASE_SERVICE=1
COPY bot.sh /bot.sh
RUN chmod +x /bot.sh
CMD /bot.sh
```

Running the provisioning one-off container
```console
# Setting both KEYBASE_USERNAME and KEYBASE_PAPERKEY will automatically
# provision the service in the "oneshot" mode - the service will identify as
# the passed paper key.

$ docker run --rm \
    -e KEYBASE_USERNAME="botname" \
    -e KEYBASE_PAPERKEY="paper key" \
    -e KEYBASE_SERVICE="1" \
    yournewimage
```

### automatically provision a new device

First start a service
```console
$ docker run --name some-keybase -d keybaseio/client
```

provision.sh
```bash
#!/usr/bin/env bash
keybase --no-auto-fork \
    --debug \
    login \
    -paperkey "$KEYBASE_PAPERKEY" \
    -devicename "$KEYBASE_DEVICENAME" \
    $KEYBASE_USERNAME
```

Dockerfile
```dockerfile
FROM keybaseio/client
COPY provision.sh /provision.sh
RUN chmod +x /provision.sh
CMD ["/provision.sh"]
```

Running the bot
```console
$ docker run --rm \
    -e KEYBASE_USERNAME="botname" \
    -e KEYBASE_PAPERKEY="paper key" \
    -e KEYBASE_DEVICENAME="randomname123" \
    yournewimage
```


## Image variants

### `keybaseio/client:stable`, `keybaseio/client:<version>`

Contains all the functionality of the Keybase client. Supports KBFS through the
CLI `keybase fs` tool.

### `keybaseio/client:stable-slim`, `keybaseio/client:<version>-slim`

Only contains the `keybase` binary and an entryscript. Ideal for simple
chat bots.

### `keybaseio/client:nightly`, `keybaseio/client:<version>-<date>-<commit>`

A nightly build of the standard `stable` image. Supports KBFS.

### `keybaseio/client:nightly-slim`, `keybaseio/client:<version>-<date>-<commit>-slim`

A nightly build of the `slim` image. Does not support KBFS. Ideal for simple
chat bots.

## License

The Keybase software is licensed under the [BSD 3-clause license](https://github.com/keybase/client/blob/master/LICENSE).

This README is based on the [Redis README](https://raw.githubusercontent.com/docker-library/docs/master/redis/README.md)
published by Docker Inc, licensed under the MIT license.

As with all Docker images, these likely also contain other software which may
be under other licenses (such as Bash, etc from the base distribution, along
with any direct or indirect dependencies of the primary software being
contained).

As for any pre-built image usage, it is the image user's responsibility to
ensure that any use of this image complies with any relevant licenses for all
software contained within.
