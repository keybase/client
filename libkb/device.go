package libkb

import (
	"encoding/hex"
	"fmt"
)

const (
	DEVICE_ID_LEN    = 32
	DEVICE_ID_SUFFIX = 0x18
)

type DeviceId [DEVICE_ID_LEN]byte

func (d DeviceId) ToString() string {
	return hex.EncodeToString(d[:])
}

func ImportDeviceId(s string) (d *DeviceId, err error) {
	if len(s) != 2*DEVICE_ID_LEN {
		err = fmt.Errorf("Bad Deviced ID length: %d", len(s))
		return
	}
	var tmp []byte
	tmp, err = hex.DecodeString(s)
	if err != nil {
		return
	}

	if c := tmp[DEVICE_ID_LEN-1]; c != DEVICE_ID_SUFFIX {
		err = fmt.Errorf("Bad suffix byte: %02x", c)
		return
	}

	var ret DeviceId
	copy(ret[:], tmp)
	d = &ret
	return
}

type DeviceStatus struct {
	Provisioned  bool
	Keyed        bool
	KeyAvailable bool
}
