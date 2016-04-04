
# Gregor

[![Build Status](https://travis-ci.org/keybase/gregor.svg?branch=master)](https://travis-ci.org/keybase/gregor)

Gregor is a simple system for consuming, persisting, and broadcasting
notifications to a collection of clients for a user.

## Documents

  * [Design](doc/design.md)
  * [Architecture](doc/arch.md)
  * [Code Organization](doc/code.md)

## Repository Layout

  * `.` — the top level interface to all major Gregor objects.  Right now, it just contains an interface.
  * [`storage/`](storage/) — storage engines for persisting Gregor objects. Right now, only SQL is implemented.
  * [`test/`](test/) — Test code that is used throughout
  * [`protocol`](protocol/) — AVDL files and output for generating protocol-friendly data types
    * [`protocol/avdl`](protocol/avdl/) — AVDL inputs
    * [`protocol/go`](protocol/go/) — Go outputs
  * [`rpc/`](keybase/rpc/) — Code for managing and routing RPCs.
