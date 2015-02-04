package libkb

import (
	"encoding/hex"
	"fmt"
)

type LKSec struct {
	serverHalf []byte
	clientHalf []byte
	secret     []byte
}

func NewLKSec() *LKSec {
	return &LKSec{}
}

func NewLKSecClientHalf(clientHalf []byte) *LKSec {
	s := NewLKSec()
	s.clientHalf = clientHalf
	return s
}

func (s *LKSec) SetClientHalf(b []byte) {
	s.clientHalf = b
}

func (s *LKSec) Load() error {
	if s.secret != nil {
		return nil
	}

	if len(s.clientHalf) == 0 {
		return fmt.Errorf("client half not set")
	}

	// get device id from config
	devid := G.Env.GetDeviceId()
	if devid == nil {
		return fmt.Errorf("no device id set")
	}

	if err := s.apiServerHalf(devid.String()); err != nil {
		return err
	}

	if len(s.clientHalf) != len(s.serverHalf) {
		return fmt.Errorf("client/server halves len mismatch: len(client) == %d, len(server) = %d", len(s.clientHalf), len(s.serverHalf))
	}

	s.secret = make([]byte, len(s.serverHalf))
	XORBytes(s.secret, s.serverHalf, s.clientHalf)

	return nil
}

func (s *LKSec) Encrypt() error {
	return nil
}

func (s *LKSec) Decrypt() error {
	return nil
}

type device struct {
	Type          int    `json:"type"`
	CTime         int64  `json:"ctime"`
	MTime         int64  `json:"mtime"`
	Description   string `json:"description"`
	Status        int    `json:"status"`
	LksServerHalf string `json:"lks_server_half"`
}

func (s *LKSec) apiServerHalf(devid string) error {
	res, err := G.API.Get(ApiArg{
		Endpoint:    "key/fetch_private",
		Args:        HttpArgs{},
		NeedSession: true,
	})
	if err != nil {
		return err
	}

	var devs struct {
		Devices map[string]device `json:"devices"`
	}
	if err = res.Body.UnmarshalAgain(&devs); err != nil {
		return err
	}
	G.Log.Info("devices: %+v", devs.Devices)

	dev, ok := devs.Devices[devid]
	if !ok {
		return fmt.Errorf("Device ID %s not found in server devices table.", devid)
	}
	s.serverHalf, err = hex.DecodeString(dev.LksServerHalf)
	if err != nil {
		return err
	}

	return nil
}
