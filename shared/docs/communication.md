## Overview

# RPC client and service

The frontend apps communicate with the go service through a variant of msgpack. There is a shared protocol definition and we have code generation which creates several types of interfaces depending on the use case. The simplest is a promise to fire and forget some value to the service. Some calls require a series of back and forth calls. These are wrapped and handled using the `Session` class and things like `incomingCallMap`. Finally we have some incoming calls where the service notifies us of a change. These are handled and plumbed into the state system through `onEngineIncoming` calls in `constants/engine`.

# Mobile rpcs

We include some native modules in the repo under `../../rnmodules`. The `react-native-kb` is a utility class to expose platform specific functions and how we communicate with the internal service library. It uses JSI to add functions exposed to the JS side and connects to the engine code.
