package jsonparserw

import (
	"fmt"

	"github.com/buger/jsonparser"
	"github.com/pkg/errors"
)

func wrapError(data []byte, keys []string, err error) error {
	return errors.Wrap(err, fmt.Sprintf("jsonparserw error in data %s with keys %v", "[redacted]", keys))
}

func ArrayEach(data []byte, cb func(value []byte, dataType jsonparser.ValueType, offset int, err error), keys ...string) (offset int, err error) {
	offset, err = jsonparser.ArrayEach(data, cb, keys...)
	return offset, wrapError(data, keys, err)
}

func GetBoolean(data []byte, keys ...string) (val bool, err error) {
	val, err = jsonparser.GetBoolean(data, keys...)
	return val, wrapError(data, keys, err)
}

func GetInt(data []byte, keys ...string) (val int64, err error) {
	val, err = jsonparser.GetInt(data, keys...)
	return val, wrapError(data, keys, err)
}

func GetString(data []byte, keys ...string) (val string, err error) {
	val, err = jsonparser.GetString(data, keys...)
	return val, wrapError(data, keys, err)
}

func Get(data []byte, keys ...string) (value []byte, dataType jsonparser.ValueType, offset int, err error) {
	value, dataType, offset, err = jsonparser.Get(data, keys...)
	return value, dataType, offset, wrapError(data, keys, err)
}
