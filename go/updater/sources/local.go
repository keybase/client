// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

// LocalUpdateSource finds releases/updates from custom url feed (used primarily for testing)
type LocalUpdateSource struct {
	log logger.Logger
}

func NewLocalUpdateSource(log logger.Logger) LocalUpdateSource {
	return LocalUpdateSource{
		log: log,
	}
}

func (k LocalUpdateSource) Description() string {
	return "Local"
}

func digest(URL string) (digest string, err error) {
	f, err := os.Open(URL[7:]) // Remove file:// prefix
	if err != nil {
		return
	}
	defer f.Close()
	hasher := sha256.New()
	if _, ioerr := io.Copy(hasher, f); ioerr != nil {
		err = ioerr
		return
	}
	digest = hex.EncodeToString(hasher.Sum(nil))
	return
}

func (k LocalUpdateSource) FindUpdate(options keybase1.UpdateOptions) (update *keybase1.Update, err error) {
	digest, err := digest(options.URL)
	if err != nil {
		return nil, err
	}
	return &keybase1.Update{
		Version: options.Version,
		Name:    fmt.Sprintf("v%s", options.Version),
		Asset: &keybase1.Asset{
			Name:   fmt.Sprintf("Keybase-%s.zip", options.Version),
			Url:    options.URL,
			Digest: digest,
		},
	}, nil
}
