// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import "encoding/json"

// Config is a KBFS git repo config file.
type Config struct {
	ID         ID
	Name       string // the original user-supplied format of the name
	CreatorUID string
	Ctime      int64 // create time in unix nanoseconds, by creator's clock
}

func configFromBytes(buf []byte) (*Config, error) {
	var c Config
	err := json.Unmarshal(buf, &c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *Config) toBytes() ([]byte, error) {
	return json.MarshalIndent(c, "", " ")
}
