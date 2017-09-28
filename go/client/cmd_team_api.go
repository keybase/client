package client

import "github.com/keybase/client/go/libkb"

type CmdTeamAPI struct {
	libkb.Contextified
	indent     bool
	inputFile  string
	outputFile string
	message    string
}
