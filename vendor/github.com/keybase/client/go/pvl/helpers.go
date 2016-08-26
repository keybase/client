// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"errors"
	"fmt"
	"strings"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func pvlServiceToString(service keybase1.ProofType) (string, libkb.ProofError) {
	for name, stat := range keybase1.ProofTypeMap {
		if service == stat {
			return strings.ToLower(name), nil
		}
	}

	return "", libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "Unsupported service %v", service)
}

func pvlJSONHasKey(w *jsonw.Wrapper, key string) bool {
	return !w.AtKey(key).IsNil()
}

func pvlJSONHasKeyCommand(w *jsonw.Wrapper, key PvlCommandName) bool {
	return !w.AtKey(string(key)).IsNil()
}

// Return the elements of an array.
func pvlJSONUnpackArray(w *jsonw.Wrapper) ([]*jsonw.Wrapper, error) {
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
func pvlJSONGetChildren(w *jsonw.Wrapper) ([]*jsonw.Wrapper, error) {
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
		return pvlJSONUnpackArray(array)
	default:
		return nil, errors.New("got children of non-container")
	}
}

// pvlJSONStringSimple converts a simple json object into a string.
// Simple objects are those that are not arrays or objects.
// Non-simple objects result in an error.
func pvlJSONStringSimple(object *jsonw.Wrapper) (string, error) {
	x, err := object.GetString()
	if err == nil {
		return x, nil
	}
	y, err := object.GetInt()
	if err == nil {
		return string(y), nil
	}
	z, err := object.GetBool()
	if err == nil {
		if z {
			return "true", nil
		}
		return "false", nil
	}
	isnil := object.IsNil()
	if isnil {
		return "null", nil
	}

	return "", fmt.Errorf("Non-simple object: %v", object)
}

// pvlSelectionContents gets the HTML contents of all elements in a selection, concatenated by a space.
func pvlSelectionContents(selection *goquery.Selection, useAttr bool, attr string) (string, error) {
	len := selection.Length()
	results := make([]string, len)
	errs := make([]error, len)
	selection.Each(func(i int, element *goquery.Selection) {
		if useAttr {
			res, ok := element.Attr(attr)
			results[i] = res
			if !ok {
				errs[i] = fmt.Errorf("Could not get attr %v of element", attr)
			}
		} else {
			results[i] = element.Text()
			errs[i] = nil
		}
	})
	for _, err := range errs {
		if err != nil {
			return "", err
		}
	}
	return strings.Join(results, " "), nil
}
