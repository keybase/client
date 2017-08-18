// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// Substitute register values for %{name} in the string.
// Regex-escape variable values
func substituteReEscape(template string, state scriptState) (string, libkb.ProofError) {
	return substituteInner(template, state, true)
}

// Substitute register values for %{name} in the string.
// Does not escape register values
func substituteExact(template string, state scriptState) (string, libkb.ProofError) {
	return substituteInner(template, state, false)
}

var nameRE = regexp.MustCompile(`%\{[\w]*\}`)

func substituteInner(template string, state scriptState, regexEscape bool) (string, libkb.ProofError) {
	var outerr libkb.ProofError
	// Regex to find %{name} occurrences.
	// Match broadly here so that even %{} is sent to the default case and reported as invalid.
	substituteOne := func(vartag string) string {
		// Strip off the %, {, and }
		varname := vartag[2 : len(vartag)-1]
		value, err := state.Regs.Get(varname)
		if err != nil {
			outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"Invalid substitution: %v", err)
			return ""
		}
		if regexEscape {
			return regexp.QuoteMeta(value)
		}
		return value
	}
	res := nameRE.ReplaceAllStringFunc(template, substituteOne)
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

// selectionText gets the Text of all elements in a selection, concatenated by a space.
// The result can be an empty string.
func selectionText(selection *goquery.Selection) string {
	var results []string
	selection.Each(func(i int, element *goquery.Selection) {
		results = append(results, element.Text())
	})
	return strings.Join(results, " ")
}

// selectionAttr gets the specified attr of all elements in a selection, concatenated by a space.
// If getting the attr of any elements fails, that does not cause an error.
// The result can be an empty string.
func selectionAttr(selection *goquery.Selection, attr string) string {
	var results []string
	selection.Each(func(i int, element *goquery.Selection) {
		res, ok := element.Attr(attr)
		if ok {
			results = append(results, res)
		}
	})
	return strings.Join(results, " ")
}

// selectionData gets the first node's data of all elements in a selection, concatenated by a space.
// The result can be an empty string.
func selectionData(selection *goquery.Selection) string {
	var results []string
	selection.Each(func(i int, element *goquery.Selection) {
		if len(element.Nodes) > 0 {
			results = append(results, element.Nodes[0].Data)
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

var hasalpha = regexp.MustCompile(`\D`)

// Check that a url is valid and has only a domain and is not an ip.
// No port, path, protocol, user, query, or any other junk is allowed.
func validateDomain(s string) bool {
	// Throw a protocol in front because the parser wants one.
	proto := "http"
	u, err := url.Parse(proto + "://" + s)
	if err != nil {
		return false
	}

	// The final group must include a non-numeric character.
	// To disallow the likes of "8.8.8.8."
	dotsplit := strings.Split(strings.TrimSuffix(u.Host, "."), ".")
	if len(dotsplit) > 0 {
		group := dotsplit[len(dotsplit)-1]
		if !hasalpha.MatchString(group) {
			return false
		}
	}

	ok := (u.IsAbs()) &&
		(u.Scheme == proto) &&
		(u.User == nil) &&
		(u.Path == "") &&
		(u.RawPath == "") &&
		(u.RawQuery == "") &&
		(u.Fragment == "") &&
		// Disallow colons. So no port, and no ipv6.
		(!strings.Contains(u.Host, ":")) &&
		// Disallow any valid ip addresses.
		(net.ParseIP(u.Host) == nil)
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

func rooterRewriteURL(ctx libkb.ProofContext, s string) (string, error) {
	u1, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	u2, err := url.Parse(ctx.GetServerURI())
	if err != nil {
		return "", err
	}

	u3 := url.URL{
		Host:     u2.Host,
		Scheme:   u2.Scheme,
		Path:     u1.Path,
		Fragment: u1.Fragment,
	}

	return u3.String(), nil
}
