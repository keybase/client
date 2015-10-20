// +build windows

// npipe_windows.go
package libkb

import (
	"errors"
	"net"
	"os/user"

	"github.com/natefinch/npipe"
)

type SocketNamedPipe struct {
	Contextified
	pipename string
}

// user.Current() includes machine name on windows, but
// this is still only a local pipe because of the dot
// following the doulble backslashes.
// If the service ever runs under a different account than
// current user, this will have to be revisited.
func NewSocket(g *GlobalContext) (ret Socket, err error) {
	currentUser, err := user.Current()
	if err != nil {
		return
	}
	if len(currentUser.Username) == 0 {
		err = errors.New("Empty username, can't make pipe")
		return
	}
	return SocketNamedPipe{
		Contextified: NewContextified(g),
		pipename:     `\\.\pipe\kbservice\` + currentUser.Username,
	}, nil
}

func (s SocketNamedPipe) BindToSocket() (ret net.Listener, err error) {
	s.G().Log.Info("Binding to pipe:%s", s.pipename)
	return npipe.Listen(s.pipename)
}

func (s SocketNamedPipe) DialSocket() (ret net.Conn, err error) {
	return npipe.Dial(s.pipename)
}
