// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package externals

import (
	"errors"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Phone numbers
//

type PhoneServiceType struct{ libkb.BaseServiceType }

func (t PhoneServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var phoneNumberRegexp = regexp.MustCompile(`^(?i:[0-9]{1,24})$`)

func (t PhoneServiceType) NormalizeUsername(s string) (string, error) {
	if !phoneNumberRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t PhoneServiceType) NormalizeRemoteName(_ libkb.MetaContext, s string) (string, error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t PhoneServiceType) GetPrompt() string {
	return "Your phone number"
}

func (t PhoneServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t PhoneServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup("")
}

func (t PhoneServiceType) DisplayName(un string) string { return "Phone" }
func (t PhoneServiceType) GetTypeName() string          { return "phone" }
func (t PhoneServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t PhoneServiceType) GetProofType() string { return "" }

func (t PhoneServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return errors.New("not implemented")
}

func (t PhoneServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return nil
}

func (t PhoneServiceType) IsDevelOnly() bool { return true }
