package httpjson

import (
	"encoding/json"

	"github.com/stellar/go/support/errors"
)

// ErrNotJSONObject is returned when Object.UnmarshalJSON is called
// with bytes not representing a valid json object.
// A valid json object means it starts with `null` or `{`, not `[`.
var ErrNotJSONObject = errors.New("input is not a json object")

// RawObject can be used directly to make sure that what's in the request body
// is not a json array:
//
// func example(ctx context.Context, in httpjson.RawObject)
//
// It can also be used as a field in a struct:
//
// type example struct {
//  	name string
//   	extra httpjson.RawObject
// }
//
// In this case, Unmarshaler will check whether extra is a json object ot not.
// It will error if extra is a json number/string/array/boolean.
//
// RawObject also implements Marshaler so that we would populate an empty json
// object is extra is not set.
type RawObject []byte

func (o RawObject) MarshalJSON() ([]byte, error) {
	if len(o) == 0 {
		return []byte("{}"), nil
	}
	return o, nil
}

func (o *RawObject) UnmarshalJSON(in []byte) error {
	var first byte
	for _, c := range in {
		if !isSpace(c) {
			first = c
			break
		}
	}
	// input does not start with 'n' ("null") or '{'
	if first != 'n' && first != '{' {
		return ErrNotJSONObject
	}

	*o = in
	return nil
}

// https://github.com/golang/go/blob/9f193fbe31d7ffa5f6e71a6387cbcf4636306660/src/encoding/json/scanner.go#L160-L162
func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\r' || c == '\n'
}

// This type is used to tell whether a JSON key is presented with its value
// being a JSON null value or is not presented.
type OptString struct {
	Value string
	Valid bool
	IsSet bool
}

func (s *OptString) UnmarshalJSON(in []byte) error {
	s.IsSet = true

	if string(in) == "null" {
		s.Valid = false
		return nil
	}

	var val string
	if err := json.Unmarshal(in, &val); err != nil {
		return err
	}

	s.Value = val
	s.Valid = true
	return nil
}
