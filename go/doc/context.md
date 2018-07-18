
# A Note On The Various "Contexts" and "LoginState"

We are in the midst of wide and slow-moving code reorgnization with two major goals:

1. To standardize as much code as possible to take one of three "context" objects, always
as a first argument: (a) Go's standard `context.Context`; (b) our rollup `libkb.MetaContext`;
or (c) our chat-specific context `chat.ChatContext`. We want to eliminate all cases
of functions taking multiple contexts, or contexts not in the first parameter slot, etc.
2. To retire `libkb.LoginState`, `libkb.LoginContext`, and `libkb.Session`, and to migrate
their roles into `libkb.ActiveDevice`.

The goal of `libkb.MetaContext` is to provide both thread-local (see `.Ctx` and `.activeDevice`) and global context (see `.g`). During signup, login or provisioning, we can store a thread local
version of the `ActiveDevice` in the `MetaContext` so that the various login and provisioning
routines can act upon it before exposing it to the rest of the program, since it's still provisional
until login completes. Once the `ActiveDevice` becomes official, then all threads can access it
via `GlobalContext`.

There's a ton of changes we'd have to make in the code to achieve these goals, and
we'd like to proceed in small piecemeal steps so that we can shake out any bugs
as we go.

# New Rules on Passing Contexts

After this migration is done, we'll have the following rules on passing contexts through
Go code

1. You can pass a `libkb.MetaContext` only as a first argument; if you do, you can
pass no other contexts.
1. You can pass a `context.Context` only as a first argument, and optionally a `libkb.GlobalContext`
as a second argument, but no other contexts.
1. You can pass a `libkb.GlobalContext` as a first argument, but if so, no other contexts.
1. You can never pass `libkb.GlobalContext` as a third or higher argument.
1. If a particular method is on a `libkb.Contextified` receiver (has a
`libkb.GlobalContext` dependency-injected), and has a `libkb.GlobalContext` or
`libkb.MetaContext` passed in, then use the `libkb.GlobalContext` from the
argument, as we intend to sunset `libkb.GlobalContext`-dependency injection.
1. In chat, you can pass a `globals.Context` as a first argument, or as a second argument
behind a `context.Context`, but never as a third argument or higher.

We're not going to get there overnight, but all code should obey these rules going forward,
and if possible, you should refactor code to be aligned with these rules.

# History

We have a long and sordid history here, and it might be worth explaining a little bit
of what happened before we describe the strategy for going forward. When we first
started this project, the Go standard `context.Context` hadn't fully formed yet,
so we didn't incorporate it. Instead, we had a notion of `GlobalContext` which applies to
all threads. At first, all threads accessed this global context via a global variable `G`,
but that strategy was terrible for many reasons, and made testing multiple instances of
Keybase in the same address space near-impossible. Thus, we embarked upon a lengthy crusade
to retire to `G` variable and use a combination of dependency-injection and just passing `G`
wherever we could.

Around the same time, we started to adopt the `context.Context` standard, especially
for logging with request-specific tags (useful for debugging). These attempts were sometimes
at odds, so we would up with an inconsistent ordering and placement of these contexts
when passed to functions. Also, though were finally able to retire `G`, we did not succeed
in fully threading `context.Context`s through the code; nor did we finish the project to always
use `context.Context`-aware versions of logging functions.

In addition, we've long had the LoginState/Account/LoginContext/Session family of objects
to manage the user's logged-in state, and to shepherd the user through signup and device
provisioning. We've experienced growing pains and bugs around the current configuration
and long for a simplification. In particular, we're not happy with the Go-channel-based
synchronization primitives at the heart of the state maintenance here, since it's easy
to hit deadlocks hidden behind layers of abstraction.  Instead, we want a simple lock-based
model, where those locks are only held briefly, never during a network request (let's say).

# Migration Strategy

## Step 1: Use NIST Tokens for Session Establishment

It used to be the case we needed the exclusive lock over Account/LoginContext
to make an API call, since it needed the user's session cookie (and CSRF
token), and it was stored there. This setup made it very easy for API calls to
fight over this locked resource and to stall, especially on application
foregrounding or resumption from a long sleep. So the solution here is to
authenticate a client to the server just based on a signature that the user
can cook up with just her/his public key. Now, API calls are no longer
dependent on Account/LoginContext, and instead depend on `ActiveDevice`, with
the exception of provisioning and signup (i.e., before proper device keys are
established).

Status: **completed**

## Step 2: Propagate MetaContext from libkb outward

### Step 2a: Replace LoginContext with a wrapper MetaContext (Part 1)


- Start with `LoginState`-related functions and propagate outwards. Cover `ActiveDevice`,
`PerUserKey`, and bubble up into `engine/` too, but only as necessary.

Status: **completed**

### Step 2b: Move `engine.Context` into `libkb.MetaContext`

- And then change all `engine/` code to take only the `libkb.MetaContext`

Status: **completed**

### Step 2c: Replace LoginContext with a wrapper MetaContext (Part 2)

- Continue with `stellar/` and `ephemeral/` to replace those functions that take
both `context.Context` and `*GlobalContext` to take only `libkb.MetaContext`.

Status: **half-done**

## Step 3: Retire LoginState

Once we get to this point, things are a little less clear. The advantage of having
done step 2 first is that a lot of times, we check for a thread-local `LoginContext`
and then fallback to one that we grab from the global state. A lot of code is
duplicated to handle these two cases, since the access pattern is different.
One strategy here might be to move to a `LoginContext`-like object that can be safely
copied, so it's no longer necessary to operate on it from outside of a closure.

We don't need to do this all at once, so we proceed engine-by-engine:

1. `engine.Signup` [#11663](https://github.com/keybase/client/pull/11664)
1. `engine.LoginWithPaperKey` [#11676](https://github.com/keybase/client/pull/11676)
1. `engine.LoginProvisionedDevice` [#11693](https://github.com/keybase/client/pull/11693)
1. `engine.Login` [#11721](https://github.com/keybase/client/pull/11721) (and others)
1. `engine.LoginLoad` --- done
1. `engine.LoginProvision` --- done
1. `engine.LoginOffline` --- done
1. `engine.LoginOneshot` --- done

Status: **completed**
