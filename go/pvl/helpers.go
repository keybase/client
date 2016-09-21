// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	b64 "encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// Substitute vars for %{name} in the string.
// Only substitutes whitelisted variables.
// It is an error to refer to an unknown variable or undefined numbered group.
// Match is an optional slice which is a regex match.
// AllowActiveString makes active_string a valid variable.
func substitute(template string, state scriptState, match []string, allowedExtras []string) (string, libkb.ProofError) {
	vars := state.Vars
	webish := (state.Service == keybase1.ProofType_DNS || state.Service == keybase1.ProofType_GENERIC_WEB_SITE)

	var outerr libkb.ProofError
	// Regex to find %{name} occurrences.
	// Match broadly here so that even %{} is sent to the default case and reported as invalid.
	re := regexp.MustCompile(`%\{[\w]*\}`)
	substituteOne := func(vartag string) string {
		// Strip off the %, {, and }
		varname := vartag[2 : len(vartag)-1]
		var value string
		switch varname {
		case "username_service":
			if !webish {
				value = vars.UsernameService
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Cannot use %v in proof type %v", varname, state.Service)
			}
		case "username_keybase":
			value = vars.UsernameKeybase
		case "sig":
			value = b64.StdEncoding.EncodeToString(vars.Sig)
		case "sig_id_medium":
			value = vars.SigIDMedium
		case "sig_id_short":
			value = vars.SigIDShort
		case "hostname":
			if webish {
				value = vars.Hostname
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Cannot use %v in proof type %v", varname, state.Service)
			}
		case "protocol":
			if state.Service == keybase1.ProofType_GENERIC_WEB_SITE {
				value = vars.Protocol
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Cannot use %v in proof type %v", varname, state.Service)
			}
		case "active_string":
			if stringsContains(allowedExtras, "active_string") {
				value = state.ActiveString
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Active string substitution now allowed")
			}
		default:
			var i int
			i, err := strconv.Atoi(varname)
			if err == nil {
				if i >= 0 && i < len(match) {
					value = match[i]
				} else {
					outerr = libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
						"Substitution argument %v out of range of match", i)
				}
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Unrecognized variable: %v", varname)
			}
		}
		return regexp.QuoteMeta(value)
	}
	res := re.ReplaceAllStringFunc(template, substituteOne)
	if outerr != nil {
		return template, outerr
	}
	return res, nil
}

func serviceToString(service keybase1.ProofType) (string, libkb.ProofError) {
	for name, stat := range keybase1.ProofTypeMap {
		if service == stat {
			return strings.ToLower(name), nil
		}
	}

	return "", libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "Unsupported service %v", service)
}

// Return the elements of an array.
func jsonUnpackArray(w *jsonw.Wrapper) ([]*jsonw.Wrapper, error) {
	w, err := w.ToArray()
	if err != nil {
		return nil, err
	}
	length, err := w.Len()
	if err != nil {
		return nil, err
	}
	res := make([]*jsonw.Wrapper, length)
	for i := 0; i < length; i++ {
		res[i] = w.AtIndex(i)
	}
	return res, nil
}

// Return the elements of an array or values of a map.
func jsonGetChildren(w *jsonw.Wrapper) ([]*jsonw.Wrapper, error) {
	dict, err := w.ToDictionary()
	isDict := err == nil
	array, err := w.ToArray()
	isArray := err == nil

	switch {
	case isDict:
		keys, err := dict.Keys()
		if err != nil {
			return nil, err
		}
		var res = make([]*jsonw.Wrapper, len(keys))
		for i, key := range keys {
			res[i] = dict.AtKey(key)
		}
		return res, nil
	case isArray:
		return jsonUnpackArray(array)
	default:
		return nil, errors.New("got children of non-container")
	}
}

// jsonStringSimple converts a simple json object into a string.
// Simple objects are those that are not arrays or objects.
// Non-simple objects result in an error.
func jsonStringSimple(object *jsonw.Wrapper) (string, error) {
	x, err := object.GetInt()
	if err == nil {
		return fmt.Sprintf("%d", x), nil
	}
	y, err := object.GetString()
	if err == nil {
		return y, nil
	}
	z, err := object.GetBool()
	if err == nil {
		if z {
			return "true", nil
		}
		return "false", nil
	}

	return "", fmt.Errorf("Non-simple object: %v", object)
}

// selectionContents gets the HTML contents of all elements in a selection, concatenated by a space.
// If getting the contents/attr value of any elements fails, that does not cause an error.
// The result can be an empty string.
func selectionContents(selection *goquery.Selection, useAttr bool, attr string) string {
	var results []string
	selection.Each(func(i int, element *goquery.Selection) {
		if useAttr {
			res, ok := element.Attr(attr)
			if ok {
				results = append(results, res)
			}
		} else {
			results = append(results, element.Text())
		}
	})

	return strings.Join(results, " ")
}

// pyindex converts an index into a real index like python.
// Returns an index to use and whether the index is safe to use.
func pyindex(index, len int) (int, bool) {
	if len <= 0 {
		return 0, false
	}
	// wrap from the end
	if index < 0 {
		index = len + index
	}
	if index < 0 || index >= len {
		return 0, false
	}
	return index, true
}

func stringsContains(xs []string, x string) bool {
	for _, y := range xs {
		if x == y {
			return true
		}
	}
	return false
}

// Check that a url is valid and has only a domain.
// No port, path, protocol, user, query, or any other junk is allowed.
func validateDomain(s string) bool {
	// Throw a protocol in front because the parser wants one.
	proto := "http"
	u, err := url.Parse(proto + "://" + s)
	if err != nil {
		return false
	}

	ok := (u.IsAbs()) &&
		(u.Scheme == proto) &&
		(u.User == nil) &&
		(u.Path == "") &&
		(u.RawPath == "") &&
		(u.RawQuery == "") &&
		(u.Fragment == "") &&
		(!strings.Contains(u.Host, ":"))
	return ok
}

// validateProtocol takes a protocol and returns the canonicalized form and whether it is valid.
func validateProtocol(s string, allowed []string) (string, bool) {
	canons := map[string]string{
		"http":     "http",
		"https":    "https",
		"dns":      "dns",
		"http:":    "http",
		"https:":   "https",
		"dns:":     "dns",
		"http://":  "http",
		"https://": "https",
		"dns://":   "dns",
	}

	canon, ok := canons[s]
	if ok {
		return canon, stringsContains(allowed, canon)
	}
	return canon, false
}
