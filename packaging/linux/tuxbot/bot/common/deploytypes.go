package common

import (
	"fmt"
)

type DeploytaskType int

const (
	DeploytaskType_RESTART         DeploytaskType = 1
	DeploytaskType_GITPULL         DeploytaskType = 2
	DeploytaskType_LOADBALANCEUP   DeploytaskType = 4
	DeploytaskType_LOADBALANCEDOWN DeploytaskType = 5
	DeploytaskType_WAIT            DeploytaskType = 6
)

type Deploytask interface {
	Type() DeploytaskType
	// Whether it should happen only happen during a deploy command, not a restart command
	DeployOnly() bool

	String() string
}

type DeploytaskRestart struct {
	Servername
	Appname
	Quick bool
}

func (d DeploytaskRestart) Type() DeploytaskType { return DeploytaskType_RESTART }
func (d DeploytaskRestart) DeployOnly() bool     { return false }
func (d DeploytaskRestart) String() string {
	desc := ""
	if d.Quick {
		desc = "-quick"
	}
	return fmt.Sprintf("restart%s on %s/%s", desc, d.Servername, d.Appname)
}

var _ Deploytask = &DeploytaskRestart{}

func NewDeploytaskRestart(s Servername, a Appname) DeploytaskRestart {
	return DeploytaskRestart{s, a, false}
}

func NewDeploytaskRestartQuick(s Servername, a Appname) DeploytaskRestart {
	return DeploytaskRestart{s, a, true}
}

type DeploytaskGitPull struct{ Servername }

func (d DeploytaskGitPull) Type() DeploytaskType { return DeploytaskType_GITPULL }
func (d DeploytaskGitPull) DeployOnly() bool     { return true }
func (d DeploytaskGitPull) String() string {
	return fmt.Sprintf("git-pull on %s", d.Servername)
}

var _ Deploytask = &DeploytaskGitPull{}

type DeploytaskLoadBalanceUp struct{ Servername }

func (d DeploytaskLoadBalanceUp) Type() DeploytaskType { return DeploytaskType_LOADBALANCEUP }
func (d DeploytaskLoadBalanceUp) DeployOnly() bool     { return false }
func (d DeploytaskLoadBalanceUp) String() string {
	return fmt.Sprintf("load-balance-up on %s", d.Servername)
}

var _ Deploytask = &DeploytaskLoadBalanceUp{}

type DeploytaskLoadBalanceDown struct{ Servername }

func (d DeploytaskLoadBalanceDown) Type() DeploytaskType { return DeploytaskType_LOADBALANCEDOWN }
func (d DeploytaskLoadBalanceDown) DeployOnly() bool     { return false }
func (d DeploytaskLoadBalanceDown) String() string {
	return fmt.Sprintf("load-balance-down on %s", d.Servername)
}

var _ Deploytask = &DeploytaskLoadBalanceDown{}

type DeploytaskWait struct {
	Servername
	Appname
	Quick bool
}

func (d DeploytaskWait) Type() DeploytaskType { return DeploytaskType_RESTART }
func (d DeploytaskWait) DeployOnly() bool     { return false }
func (d DeploytaskWait) String() string {
	desc := ""
	if d.Quick {
		desc = "-quick"
	}
	return fmt.Sprintf("wait%s on %s/%s", desc, d.Servername, d.Appname)
}

var _ Deploytask = &DeploytaskWait{}

type Instancename struct {
	Servername Servername
	Appname    Appname
}
type Deployset = []Deploytask
type Deployschedule = []Deployset
