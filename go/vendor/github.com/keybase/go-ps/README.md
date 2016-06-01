# Process List Library for Go

[![Build Status](https://travis-ci.org/keybase/go-ps.svg?branch=master)](https://travis-ci.org/keybase/go-ps)
[![Build Status](https://ci.appveyor.com/api/projects/status/github/keybase/go-ps?branch=master&svg=true)](https://ci.appveyor.com/project/keybase/go-ps)
[![Coverage Status](https://coveralls.io/repos/github/keybase/go-ps/badge.svg?branch=master)](https://coveralls.io/github/keybase/go-ps?branch=master)
[![GoDoc](https://godoc.org/github.com/keybase/go-ps?status.svg)](https://godoc.org/github.com/keybase/go-ps)


go-ps is a library for Go that implements OS-specific APIs to list and
manipulate processes in a platform-safe way. The library can find and
list processes on Linux, Mac OS X, and Windows.

If you're new to Go, this library has a good amount of advanced Go educational
value as well. It uses some advanced features of Go: build tags, accessing
DLL methods for Windows, cgo for Darwin, etc.

How it works:

  * **Darwin** uses `sysctl` and `proc_listpids` (for the path) to retrieve the process table, via cgo.
  * **Unix** uses the procfs at `/proc` to inspect the process tree.
  * **Windows** uses the Windows API, and methods such as
    `CreateToolhelp32Snapshot` to get a point-in-time snapshot of
    the process table.

## Installation

Install using standard `go get`:

```
$ go get github.com/keybase/go-ps
```
