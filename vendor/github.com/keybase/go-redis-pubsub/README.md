go-redis-pubsub
==================

[![Build Status](https://travis-ci.org/aalness/go-redis-pubsub.svg?branch=master)](https://travis-ci.org/aalness/go-redis-pubsub)

This library is a small specialized Go client for [Redis pub/sub](http://redis.io/topics/pubsub). I'm using it to support real-time high-throughput messaging between server instances when the expected channel count is large and the subscription pattern is very dynamic.

It's implemented using [redigo](https://github.com/garyburd/redigo).

### Features

- Manages a subscription pool on behalf of the user to allow for concurrent channel subscription processing and automatic reconnection with exponential backoff.
- Attempts to mitigate `SUBSCRIBE` / `UNSUBSCRIBE` thrash by delaying unsubscription via a timer mechanism.
- Manages a send buffer and worker pool with the help of the `redis.Pool` implementation.
- Provides a handler callback interface for both subscribers and publishers.
