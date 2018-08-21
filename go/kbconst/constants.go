// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

type RunMode string

const (
	DevelRunMode      RunMode = "devel"
	StagingRunMode    RunMode = "staging"
	ProductionRunMode RunMode = "prod"
	RunModeError      RunMode = "error"
	NoRunMode         RunMode = ""
)

const KBFSLogFileName = "keybase.kbfs.log"
