package emails

import (
	"context"
	"net/mail"
	"strings"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
)

// splitBulk splits on newline or comma.
func splitBulk(s string) []string {
	f := func(c rune) bool {
		return c == '\n' || c == ','
	}
	split := strings.FieldsFunc(s, f)
	for i, s := range split {
		split[i] = strings.TrimSpace(s)
	}
	return split
}

// ParseSeparatedEmails parses a comma-or-new-line-separated email list that
// comes in a string. It can extract emails that conform to RFC 5322 and RFC
// 6532 (see net/mail documentation for more info).
//
// Examples of a valid e-mail entities would be:
// - Jan Smith <jan@example.com>
// - alice@example.org
//
// The "name" portion is ignored, caller will always get the raw e-mails, in
// this case: { "jan@example.com", "alice@example.org" }.
//
// Individual e-mails have to be separated by comma or newline, and they can be
// surrounded by any amount of whitespace characters that will be ignored.
//
// `malformed` is an optional pointer to string list to which this function can
// append malformed e-mails for the caller. It can be nil.
func ParseSeparatedEmails(mctx libkb.MetaContext, emails string, malformed *[]string) (ret []string) {
	emailList := splitBulk(emails)
	mctx.Debug("ParseSeparatedEmails: bulk email invite count: %d", len(emailList))
	for _, email := range emailList {
		addr, parseErr := mail.ParseAddress(email)
		if parseErr != nil {
			mctx.Debug("ParseSeparatedEmails: skipping malformed email %q: %s", email, parseErr)
			if malformed != nil {
				*malformed = append(*malformed, email)
			}
			continue
		}

		// API server side of this only accepts x.yy domain name:
		parts := strings.Split(addr.Address, ".")
		if len(parts[len(parts)-1]) < 2 {
			mctx.Debug("ParseSeparatedEmails: skipping malformed email (domain) %q", email)
			if malformed != nil {
				*malformed = append(*malformed, email)
			}
			continue
		}

		ret = append(ret, addr.Address)
	}
	return ret
}

// CreateAssertionFromEmail creates AssertionURL from an e-mail address. E-mail
// address is not validated apart from the minimal validation that assertion
// code does, so pretty much anything that has '@' in it will pass.
func CreateAssertionFromEmail(ctx context.Context, email string) (libkb.AssertionURL, error) {
	actx := externals.MakeStaticAssertionContext(ctx)
	// `strict` argument here doesn't actually do anything for "email" assertions.
	return libkb.ParseAssertionURLKeyValue(actx, "email", email, false /* strict */)
}
