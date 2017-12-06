// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"net"
	"strings"

	"go.uber.org/zap"
)

const (
	keybasePagesPrefix = "kbp="
)

// ErrKeybasePagesRecordNotFound is returned when a domain requested doesn't
// have a kbp= recored configured.
type ErrKeybasePagesRecordNotFound struct{}

// Error implements the error interface.
func (ErrKeybasePagesRecordNotFound) Error() string {
	return "no TXT record is found for " + keybasePagesPrefix
}

// ErrKeybasePagesRecordTooMany is returned when a domain requested has more
// than one kbp= recored configured.
type ErrKeybasePagesRecordTooMany struct{}

// Error implements the error interface.
func (ErrKeybasePagesRecordTooMany) Error() string {
	return "more than 1 TXT record are found for " + keybasePagesPrefix
}

// LoadRootFromDNS loads the root path configured for domain by looking for
// a "kbp=" DNS TXT record on the domain, parse it as Root and return it.
//
// There should be exactly one "kbp=" TXT record configured for domain. If more
// than one exists, an ErrKeybasePagesRecordTooMany{} is returned. If none is
// found, an ErrKeybasePagesRecordNotFound{} is returned.
//
// NOTE that a TXT record that's long than 256 characters can optionally be
// split to multiple quoted strings. https://github.com/golang/go/issues/10482
//
// Examples:
//
// static.keybase.io TXT "kbp=/keybase/team/keybase.bots/static.keybase.io"
// meatball.gao.io   TXT "kbp=/keybase/public/songgao/meatball/"
// song.gao.io       TXT "kbp=/keybase/private/songgao,kb_bot/blah"
// blah.strib.io     TXT "kbp=/keybase/private/strib#kb_bot/blahblahb" "lah/blah/"
// kbp.jzila.com     TXT "kbp=git-keybase://private/jzila,kb_bot/kbp.git"
func LoadRootFromDNS(log *zap.Logger, domain string) (root Root, err error) {
	var rootPath string

	defer func() {
		if err == nil {
			log.Info("LoadRootFromDNS",
				zap.String("domain", domain),
				zap.String("root_path", rootPath),
			)
		} else {
			log.Warn("LoadRootFromDNS",
				zap.String("domain", domain),
				zap.String("root_path", rootPath),
				zap.Error(err),
			)
		}
	}()

	txtRecords, err := net.LookupTXT(domain)
	if err != nil {
		return Root{}, err
	}

	for _, r := range txtRecords {
		r = strings.TrimSpace(r)

		if strings.HasPrefix(r, keybasePagesPrefix) {
			if len(rootPath) != 0 {
				return Root{}, ErrKeybasePagesRecordTooMany{}
			}
			rootPath = r[len(keybasePagesPrefix):]
		}
	}

	if len(rootPath) == 0 {
		return Root{}, ErrKeybasePagesRecordNotFound{}
	}

	return ParseRoot(rootPath)
}
