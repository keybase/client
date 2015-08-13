// +build gofuzz

package libkb

import "github.com/keybase/client/go/libkb"

func Fuzz(data []byte) int {
	key, err := libkb.ReadOneKeyFromBytes(data)
	if err != nil {
		if key != nil {
			panic("key not nil on error")
		}
		return 0
	}
	return 1
}
