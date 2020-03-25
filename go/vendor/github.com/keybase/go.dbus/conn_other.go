// +build !darwin

package dbus

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
)

func sessionBusPlatform() (*Conn, error) {
	cmd := exec.Command("dbus-launch")
	// dbus-launch can write to stderr which can cause issues if it is parsed
	// ref: https://github.com/keybase/client/issues/23054
	b, err := cmd.Output()

	if err != nil {
		return nil, err
	}

	i := bytes.IndexByte(b, '=')
	j := bytes.IndexByte(b, '\n')

	if i == -1 || j == -1 {
		return nil, errors.New("dbus: couldn't determine address of session bus")
	}

	if i > j {
		return nil, fmt.Errorf("dbus: failed to parse output of dbus; got endpoints (%d, %d)", i, j)
	}

	return Dial(string(b[i+1 : j]))
}
