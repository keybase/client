// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"testing"
)

type dktest struct {
	name       string
	passphrase string
	salt       string
	pwh        string
	ekey       string
	dkey       string
	lkey       string
}

var dktests = []dktest{
	{
		name:       "simple 1",
		passphrase: "my passphrase",
		salt:       "random salt zxcv",
		pwh:        "eb92a4bc72cbce98b80c5bfb391b353c37af5f3398e52c7cb436b73de97abc48",
		ekey:       "248f73a3645486c7d2c327da2bb7bb3129cf2347494d54ca9e35083f325ab57e",
		dkey:       "b4f8ffced85c240c4833afac527ce1f9be37e2e645fc020d41c31d8179ff7ef2",
		lkey:       "daf502dcc05af15e8c9b4c36a195566e1cfdd5dbb7593e268e0053e89ed74c0f",
	},
	{
		name:       "simple 2",
		passphrase: "my passphrase",
		salt:       "random salt qwer",
		pwh:        "5c44c619c7f29bc446af06ecd2d5c8d0a58db04970891aa18084fac8014c717a",
		ekey:       "c93b7470701a0623a062b849f0527b68faa568549926b77320e9030b12d29197",
		dkey:       "77375b7d2e59b9fdd4733dbead5ba66116cec508e05919b98332b97e437a75b0",
		lkey:       "5fec13005cca4f12ce0b624db02488d9ea4e5ef54b67649620c810e6b4e01376",
	},
	{
		name:       "simple 3",
		passphrase: "my passphrase is longer",
		salt:       "random salt zxcv",
		pwh:        "de526ef302f50283d0a0aecdc303e1f42c3b206060657bf03f781f076eec1459",
		ekey:       "199c9e10e5c9505c431cd2d3235873e7e113918511178afc341d28d48f1b5dd7",
		dkey:       "1c2c2d040fc743f939b1af6e90dde1a0e9181e2d6a0e584c75f7d363100493d5",
		lkey:       "66647f005c89d55efbc4683b2a86210d545d77e6fadfd29b8aa9bcc53efc5a7f",
	},
}

func TestTSPassKey(t *testing.T) {
	for _, test := range dktests {
		_, dk, err := StretchPassphrase(nil, test.passphrase, []byte(test.salt))
		if err != nil {
			t.Errorf("%s: got unexpected error: %s", test.name, err)
			continue
		}
		if hex.EncodeToString(dk.PWHash()) != test.pwh {
			t.Errorf("%s: pwh = %x, expected %q", test.name, dk.PWHash(), test.pwh)
		}
		if hex.EncodeToString(dk.EdDSASeed()) != test.ekey {
			t.Errorf("%s: eddsa = %x, expected %q", test.name, dk.EdDSASeed(), test.ekey)
		}
		if hex.EncodeToString(dk.DHSeed()) != test.dkey {
			t.Errorf("%s: dh = %x, expected %q", test.name, dk.DHSeed(), test.dkey)
		}
		if hex.EncodeToString(dk.LksClientHalf().Bytes()) != test.lkey {
			t.Errorf("%s: lks = %x, expected %q", test.name, dk.LksClientHalf(), test.lkey)
		}
	}
}
