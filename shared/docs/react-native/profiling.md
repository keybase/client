# Intro

React is usually fast, and react-native itself can be surprisingly fast.
Unfortunately it's easy to do things that can jeopardize speed. Profiling
gives you a deeper understanding of where time is going. The best way to
understand something is to fix it. Profiling is our versatile tool into fixing
performance problems.


## Prerequisite Reading

I won't repeat what other's have said, so here is some necessary prereq
reading.

* [React Native's Performace doc](https://facebook.github.io/react-native/docs/performance)
  * It has a lot of good stuff and ideas. The rest of this will assume you've read
the prereqs

* [Parashuram's Dive into RN performance](hthp://blog.nparashuram.com/2018/11/react-native-performance-playbook-part-i.html)
  * This is mostly android specific, but still generally useful
  * Shows by example some RN profiling tools that aren't well documented

* [React's own profiler](https://reactjs.org/blog/2018/09/10/introducing-the-react-profiler.html)
  * This is react dev tool's own profiler. It includes more react specific
    information than just user timings. If you're optimizing a component this
    is what you want.

* [Chrome timeline](https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/reference)
  * Look at this for a basic understanding of how to use the chrome timeline
    view. We use this to look at user timings. We can visualize the perfomance
    calls with this.

* [JS Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
  * Basically understand how to use `performance.mark` and
    `performance.measure` this is useful for user timing stuff.

## Considerations when remote debugging
When using the remote debugging, remember that your computer is much faster at
running JS than your phone. On android this is pretty noticeable. There is a
setting to throttle your CPU when you profile the app in the timeline view, and
I find that useful in trying to get closer to what the android phone would do.

## User Timings
`Performance.mark` and `Performance.measure` are useful tools to see how long
things take. Chrome's user timings will also display these in the timeline
view. Thanks to Nojima, we already have quite a bit. Turn on userTimings in
local-debug and you'll get user timings for engine calls, saga calls, and
reducer calls. Sometimes the saga calls can be unwieldy so it may help to
manually create a filter on which types of saga calls will get
profiled. You can modify `util/user-timings` to do this.

Make sure you have a performance polyfill setup or it will fail when running on
the native device (at least on android)

## Bundling strategies
[React Native's Performace
doc](https://facebook.github.io/react-native/docs/performance) has a section on
this. As of my latest test, there isn't a real difference in using this, but
this will likely change when we stop loading so many files on startup.

There is an issue with indexed-ram-bundling on [android](https://github.com/facebook/react-native/issues/21282)

## ReactNative.Systrace

Api [here](https://facebook.github.io/react-native/docs/systrace)

This is super useful in analyzing startup time performance cost. You can use
this to see how long requires are taking. But there's a trick. You have to
change the implementation of a couple methods for it to work properly.

Add this to your entry file to enable Systrace (you can also enable it via RN
devtools)

```
require.Systrace.setEnabled(true)

let name = ''
require.Systrace.beginEvent = message => {
  name = message
  performance.mark(name)
}

require.Systrace.endEvent = () => {
  performance.measure(name, name)
}
```

The important thing is that beginEvent and endEvent are defined. Otherwise it
tries to use some nativeTracingMethod that isn't define.

This doesn't work outside of dev mode.

It may also be possible to compile the JS VM with some native hook for
systrace, but I haven't bothered with this. This is likely what FB does
internally and why that method is broken by default.

## Case study - Profiling Android startup time

### Abstract

I wanted to investigate what was taking android so long to startup. This
especially hurts us when we come in from a push notifcation to respond to a
message. In profiling, I found that our average startup time was around 4.4s on
my pixel with release settings. I wasn't able to bring that number down without
much more work, but I'll outline the steps I took so we can try this again
while we do the fixes I'll suggest at the end.

### The starting case

First I used Parashuram setup to mark the tti_complete as the latest
message in the chat view. Then I built the app with `gradle
installReleaseUnsigned`. This is the same as the release build, but not signed
with our publishing key. Then I setup a simple node http server to receive the
trace-event payload.

[The simple node server](https://gist.github.com/MarcoPolo/0d3186becbce74bc8f21c9deab33dcc0)

Run this a couple of times to get the starting number that you're going to try
to improve.

### Investigating slowdowns

I enabled RN's systrace with the method listed above. as soon as
I did this I saw the culprits. We load most of the app
at startup before we can even make a single engine call. Our current routing
model is the culprit here. Our current routing system asks us to import
everything right from the get go.

Diving slightly closer, emoji-datasource is a huge slow down. Taking about 0.3s
itself to load. This is probably because it has to parse a lot of emoji data.
but it's a little silly we have to do this at runtime.

### Delayed Handshake

I also noticed that we wait quite a bit before we can even start the handshake
with the engine. Part of this is that we need to require so many files before
we can start the work with the engine.

I tried moving the setup that happens in `app/index.native` to happen before.
But I didn't see a signifcant startup time difference. My guess is that without
changing all files necessary to start the bootstrapping, we still load most of
the app. So there isn't a real difference.


### Areas to improve (in order or biggest impact and easiest to implement)

* Use an alternate routing scheme that will load the screens when required or
  when idle.
  * this is involved, but we are doing this anyways. It would have a huge
    impact since we wait around 2s everytime before we can do anything! That's
    2s from the point we can start running JS to the point we've required all
    the files we need to start the bootstrap process.
* Minimal time to engine handshake. By requiring less files before we can start
  the engine handshake, we can get a headstart on this and lower the time until
  we can get useful data back from the engine.
* Investigate if we can get by with loading a minimal version of emoij data


