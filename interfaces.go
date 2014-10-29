package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type Command interface {
	libkb.Command
	ParseArgv(*cli.Context) error // A command-specific parse-args
	Run() error                   // Actually run the command (finally!)
}
