package main

import (
	"errors"
	"fmt"
)

var errExactlyOnePath = errors.New("exactly one path must be specified")
var errAtLeastOnePath = errors.New("at least one path must be specified")
var errCannotSplit = errors.New("cannot split path")

type invalidKbfsPathErr struct {
	pathStr string
}

func (e invalidKbfsPathErr) Error() string {
	return fmt.Sprintf("invalid kbfs path %s", e.pathStr)
}

type cannotJoinErr struct {
	p    kbfsPath
	name string
}

func (e cannotJoinErr) Error() string {
	return fmt.Sprintf("cannot join %s to %s", e.p, e.name)
}

type cannotWriteErr struct {
	pathStr string
	err     error
}

func (e cannotWriteErr) Error() string {
	if e.err != nil {
		return fmt.Sprintf("cannot write to %s: %v", e.pathStr, e.err)
	}
	return fmt.Sprintf("cannot write to %s", e.pathStr)
}
