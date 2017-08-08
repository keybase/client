// +build gofuzz

package libkb

import (
	"github.com/keybase/client/go/libkb"
)

func Fuzz(data []byte) int {
	libkb.CheckDeviceName.F(string(data))
	return 1
}
