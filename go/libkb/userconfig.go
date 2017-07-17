// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//==================================================================

// NormalizedUsername is a username that has been normalized (toLowered)
// and therefore will compare correctly against other normalized usernames.
type NormalizedUsername string

// NewNormalizedUsername makes a normalized username out of a non-normalized
// plain string username
func NewNormalizedUsername(s string) NormalizedUsername {
	return NormalizedUsername(strings.ToLower(s))
}

// Eq returns true if the given normalized usernames are equal
func (n NormalizedUsername) Eq(n2 NormalizedUsername) bool {
	return string(n) == string(n2)
}

// String returns the normalized username as a string (in lower case)
func (n NormalizedUsername) String() string { return string(n) }

// IsNil returns true if the username is the empty string
func (n NormalizedUsername) IsNil() bool { return len(string(n)) == 0 }

func NormalizedUsernamesToStrings(names []NormalizedUsername) []string {
	y := make([]string, len(names))
	for i, n := range names {
		y[i] = n.String()
	}
	return y
}

//==================================================================

type UserConfig struct {
	ID     string             `json:"id"`
	Name   NormalizedUsername `json:"name"`
	Salt   string             `json:"salt"`
	Device *string            `json:"device"`

	importedID       keybase1.UID
	importedSalt     []byte
	importedDeviceID keybase1.DeviceID
}

//==================================================================

func (u UserConfig) GetUID() keybase1.UID            { return u.importedID }
func (u UserConfig) GetUsername() NormalizedUsername { return u.Name }
func (u UserConfig) GetSalt() []byte                 { return u.importedSalt }
func (u UserConfig) GetDeviceID() keybase1.DeviceID  { return u.importedDeviceID }

//==================================================================

func NewUserConfig(id keybase1.UID, name NormalizedUsername, salt []byte, dev keybase1.DeviceID) *UserConfig {
	ret := &UserConfig{
		ID:               id.String(),
		Name:             name,
		Salt:             hex.EncodeToString(salt),
		Device:           nil,
		importedID:       id,
		importedSalt:     salt,
		importedDeviceID: dev,
	}
	if dev.Exists() {
		tmp := dev.String()
		ret.Device = &tmp
	}
	return ret
}

//==================================================================

func (u *UserConfig) Import() (err error) {
	var tmp keybase1.UID
	if tmp, err = UIDFromHex(u.ID); err != nil {
		return
	}
	u.importedID = tmp
	if u.importedSalt, err = hex.DecodeString(u.Salt); err != nil {
		return
	}
	if u.Device != nil {
		if u.importedDeviceID, err = keybase1.DeviceIDFromString(*u.Device); err != nil {
			return
		}
	}
	return
}

//==================================================================

func ImportUserConfigFromJSONWrapper(jw *jsonw.Wrapper) (ret *UserConfig, err error) {
	var tmp UserConfig
	if jw == nil {
		return
	}
	if err = jw.UnmarshalAgain(&tmp); err != nil {
		return
	}
	if err = tmp.Import(); err != nil {
		return
	}
	ret = &tmp
	return
}

//==================================================================

func (u *UserConfig) SetDevice(d keybase1.DeviceID) {
	u.importedDeviceID = d
	var s *string
	if d.Exists() {
		tmp := d.String()
		s = &tmp
	}
	u.Device = s
	return
}

//==================================================================
