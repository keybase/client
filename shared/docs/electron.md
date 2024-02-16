## Overview

The electron app has two sides, the node side and the renderer side.
The node side does as little as possible as its harder to debug and more privileged.
In order for the renderer side to do node-type things we use a message passing protocol to ask node to do certain thing and that is exposed to the renderer through the electron preload mechanism.

We have several renderers. The app is 'main', and we have the widget (menubar), and a couple of windows that can be launched (pinentry for logins, unlock folders for kbfs issues, tracker for kbfs identify issues, etc)
In order to simplify debugging and state management the main app holds all state and then sends subsets out to the remote windows.
We render 'Proxy' objects which capture this state as invisible components and when they render we serialize the data to them (with some deduping)
The remote windows accept these payloads and fill their own local stores to render. Actions are also capture and serialized back to the main window to make rpc calls and update the local state.

We use webpack to bundle all the js files and html files for the various renderers and the node side.
