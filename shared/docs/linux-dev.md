# Troubleshooting

## Hot reloading / File Watching

### Linux
If it seems like hot reloading or anything that depends on
file-watching isn't working on Linux, you're probably running into
`inotify` limits. As a quick check, try doing

```sh
tail -f (some file)
```

If you get

```
tail: inotify cannot be used, reverting to polling: Too many open files
```

then that's a telltale sign of running out of `inotify` watches. For more details, do (in bash)

```sh
echo "pid    watches cmd"; for x in $(find /proc/*/fd/* -type l -lname 'anon_inode:inotify' 2>/dev/null); do PID=$(echo $x | cut -f 3 -d'/'); FD=$(echo $x | cut -f 5 -d'/'); WATCHCOUNT=$(grep -c inotify /proc/$PID/fdinfo/$FD); CMD=$(cat /proc/$PID/cmdline | sed 's/\x0/ /g'); echo "$PID       $WATCHCOUNT     $CMD"; done | sort -k 2 -n -r
```

which prints a list of commands with inotify watches sorted by number
of watches in decreasing order. On my system, flow and storybook use
up about 11000 watches. (See [this StackExchange
answer](https://unix.stackexchange.com/a/426001) for an explanation
for the above one-liner; however, its command is slower due to using
`lsof`.)

See [this
link](https://github.com/guard/listen/wiki/Increasing-the-amount-of-inotify-watchers)
for how to increase the watch limit; I set mine to 65536.

