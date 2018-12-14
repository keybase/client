// +build darwin

package ps

import (
	"github.com/keybase/go-ps/darwincgo"
)

func findProcess(pid int) (Process, error) {
	m, err := darwincgo.ProcessMap()
	if err != nil {
		return nil, err
	}
	p := m[pid]
	if p == nil {
		return nil, nil
	}
	return p, nil
}

func processes() ([]Process, error) {
	m, err := darwincgo.ProcessMap()
	if err != nil {
		return nil, err
	}
	ps := make([]Process, 0, len(m))
	for _, dp := range m {
		ps = append(ps, dp)
	}
	return ps, nil
}
