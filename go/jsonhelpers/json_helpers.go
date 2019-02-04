package jsonhelpers

import (
	"errors"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// JSONStringSimple converts a simple json object into a string.  Simple
// objects are those that are not arrays or objects.  Non-simple objects result
// in an error.
func JSONStringSimple(object *jsonw.Wrapper) (string, error) {
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
func JSONGetChildren(w *jsonw.Wrapper) ([]*jsonw.Wrapper, error) {
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

// Most failures here log instead of returning an error. If an error occurs,
// ([], nil) will be returned.  This is because a selector may descend into
// many subtrees and fail in all but one.
func AtSelectorPath(selectedObject *jsonw.Wrapper, selectors []keybase1.SelectorEntry,
	logger func(format string, arg ...interface{}), mkErr func(selector keybase1.SelectorEntry) error) ([]*jsonw.Wrapper, error) {
	// The terminating condition is when we've consumed all the selectors.
	if len(selectors) == 0 {
		return []*jsonw.Wrapper{selectedObject}, nil
	}

	selector := selectors[0]
	nextselectors := selectors[1:]

	switch {
	case selector.IsIndex:
		object, err := selectedObject.ToArray()
		if err != nil {
			logger("JSON select by index from non-array: %v (%v) (%v)", err, selector.Index, object)
			return nil, nil
		}
		length, err := object.Len()
		if err != nil {
			return nil, nil
		}

		index, ok := pyindex(selector.Index, length)
		if !ok || index < 0 {
			return nil, nil
		}
		nextobject := object.AtIndex(index)
		return AtSelectorPath(nextobject, nextselectors, logger, mkErr)
	case selector.IsKey:
		object, err := selectedObject.ToDictionary()
		if err != nil {
			logger("JSON select by key from non-map: %v (%v) (%v)", err, selector.Key, object)
			return nil, nil
		}

		nextobject := object.AtKey(selector.Key)
		return AtSelectorPath(nextobject, nextselectors, logger, mkErr)
	case selector.IsAll:
		children, err := JSONGetChildren(selectedObject)
		if err != nil {
			logger("JSON select could not get children: %v (%v)", err, selectedObject)
			return nil, nil
		}
		var results []*jsonw.Wrapper
		for _, child := range children {
			innerresults, perr := AtSelectorPath(child, nextselectors, logger, mkErr)
			if perr != nil {
				return nil, perr
			}
			results = append(results, innerresults...)
		}
		return results, nil
	default:
		return nil, mkErr(selector)
	}
}
