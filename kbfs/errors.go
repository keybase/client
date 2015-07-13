package main

import "errors"

var errExactlyOnePath = errors.New("exactly one path must be specified")
var errAtLeastOnePath = errors.New("at least one path must be specified")
