// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"net"
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// RootLoader is the interface for loading a site root. This interface exists
// for instrumenting tests. In real instances, only the DNSRootLoader should be
// used.
type RootLoader interface {
	LoadRoot(domain string) (root Root, err error)
}

// DNSRootLoader is an implementation of RootLoader loads a root from DNS. This
// is the RootLoader that should be used in all non-test scenarios. See doc for
// LoadRoot for more.
type DNSRootLoader struct {
	log *zap.Logger
}

const (
	keybasePagesPrefix = "kbp="
)

// ErrKeybasePagesRecordNotFound is returned when a domain requested doesn't
// have a kbp= record configured.
type ErrKeybasePagesRecordNotFound struct{}

// Error implements the error interface.
func (ErrKeybasePagesRecordNotFound) Error() string {
	return "no TXT record is found for " + keybasePagesPrefix
}

// ErrKeybasePagesRecordTooMany is returned when a domain requested has more
// than one kbp= record configured.
type ErrKeybasePagesRecordTooMany struct{}

// Error implements the error interface.
func (ErrKeybasePagesRecordTooMany) Error() string {
	return "more than 1 TXT record are found for " + keybasePagesPrefix
}

// kbpRecordPrefixes specifies the TXT record prefixes that we look at to
// locate the root of these Keybase pages. We have 2 records since some
// registrars don't support underscores in the middle of a domain. This order
// must remain fixed since it reflects the order the strings are evaluated in.
var kbpRecordPrefixes = []string{"_keybase_pages.", "_keybasepages."}

// LoadRoot loads the root path configured for domain from DNS, with following
// steps:
//   1. Construct a domain name by prefixing the `domain` parameter with
//      "_keybase_pages." or "_keybasepages". So for example,
//      "static.keybase.io" turns into "_keybase_pages.static.keybase.io" or
//      "_keybasepages.static.keybase.io".
//   2. Load TXT record(s) from the domain constructed in step 1, and look for
//      one starting with "kbp=". If exactly one exists, parse it into a `Root`
//      and return it.
//
// There must be exactly one "kbp=" TXT record configured for domain. If more
// than one exists, an ErrKeybasePagesRecordTooMany{} is returned. If none is
// found, an ErrKeybasePagesRecordNotFound{} is returned. In case user has some
// configuration that requires other records that we can't foresee for now,
// other records (TXT or not) can co-exist with the "kbp=" record (as long as
// no CNAME record exists on the "_keybase_pages." or "_keybasepages." prefixed
// domain of course).
//
// If the given domain is invalid, it would cause the domain name constructed
// in step will be invalid too, which causes Go's DNS resolver to return a
// net.DNSError typed "no such host" error.
//
// Examples for "static.keybase.io", "meatball.gao.io", "song.gao.io",
// "blah.strib.io", and "kbp.jzila.com" respectively:
//
// _keybase_pages.static.keybase.io TXT "kbp=/keybase/team/keybase.bots/static.keybase.io"
// _keybase_pages.meatball.gao.io   TXT "kbp=/keybase/public/songgao/meatball/"
// _keybase_pages.song.gao.io       TXT "kbp=/keybase/private/songgao,kb_bot/blah"
// _keybase_pages.blah.strib.io     TXT "kbp=/keybase/private/strib#kb_bot/blahblahb" "lah/blah/"
// _keybase_pages.kbp.jzila.com     TXT "kbp=git@keybase:private/jzila,kb_bot/kbp.git"
func (l DNSRootLoader) LoadRoot(domain string) (root Root, err error) {
	var rootPath string

	defer func() {
		zapFields := []zapcore.Field{
			zap.String("domain", domain),
			zap.String("kbp_record", rootPath),
		}
		if err == nil {
			l.log.Info("LoadRootFromDNS", zapFields...)
		} else {
			l.log.Warn("LoadRootFromDNS", append(zapFields, zap.Error(err))...)
		}
	}()

	// Check all possible kbp record prefixes.
	var txtRecords []string
	for _, kbpRecordPrefix := range kbpRecordPrefixes {
		txtRecords, err = net.LookupTXT(kbpRecordPrefix + domain)
		if err == nil {
			break
		}
	}
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
