package jsonw

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
)

type Wrapper struct {
	dat    interface{}
	err    *Error
	access []string
}

type Error struct {
	msg string
}

type DepthError struct {
	msg string
}

func (d DepthError) Error() string {
	return fmt.Sprintf("DepthError: %s", d.msg)
}

const defaultMaxDepth int = 50

func (w *Wrapper) Marshal() ([]byte, error) {
	return json.Marshal(w.dat)
}

// MarshalJSON makes Wrapper satisfy the encoding/json.Marshaler interface.
func (w *Wrapper) MarshalJSON() ([]byte, error) {
	return w.Marshal()
}

func (w *Wrapper) MarshalPretty() string {
	encoded, err := json.MarshalIndent(w.dat, "", "    ")
	if err != nil {
		return fmt.Sprintf("<bad JSON structure: %s>", err.Error())
	} else {
		return string(encoded)
	}
}

func (w *Wrapper) MarshalToDebug() string {
	buf, err := w.Marshal()
	if err != nil {
		return fmt.Sprintf("<bad JSON structure: %s>", err.Error())
	} else {
		return string(buf)
	}
}

func Unmarshal(unsafeRaw []byte) (*Wrapper, error) {
	return UnmarshalWithMaxDepth(unsafeRaw, defaultMaxDepth)
}

func UnmarshalWithMaxDepth(unsafeRaw []byte, maxDepth int) (*Wrapper, error) {
	err := EnsureMaxDepth(bufio.NewReader(bytes.NewReader(unsafeRaw)), maxDepth)
	if err != nil {
		return nil, err
	}
	raw := unsafeRaw

	var iface interface{}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	err = dec.Decode(&iface)
	var ret *Wrapper
	if err == nil {
		ret = NewWrapper(iface)
	}
	return ret, err
}

func WrapperFromObject(obj interface{}) (*Wrapper, error) {
	// Round tripping through []byte isn't very efficient. Is there a smarter way?
	encoded, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	return Unmarshal(encoded)
}

func (e Error) Error() string { return e.msg }

func (w *Wrapper) NewError(format string, a ...interface{}) *Error {
	m1 := fmt.Sprintf(format, a...)
	p := w.AccessPath()
	m2 := fmt.Sprintf("%s: %s", p, m1)
	return &Error{m2}
}

func (w *Wrapper) wrongType(want string, got reflect.Kind) *Error {
	return w.NewError("type error: wanted %s, got %s", want, got)
}

func (i *Wrapper) getData() interface{} { return i.dat }
func (i *Wrapper) IsOk() bool           { return i.Error() == nil }

func (i *Wrapper) GetData() (dat interface{}, err error) {
	if i.err != nil {
		err = *i.err
	} else {
		dat = i.dat
	}
	return
}

func (i *Wrapper) GetDataVoid(dp *interface{}, ep *error) {
	d, e := i.GetData()
	if e == nil {
		*dp = d
	} else if e != nil && ep != nil && *ep == nil {
		*ep = e
	}

}

func (i *Wrapper) Error() (e error) {
	if i.err != nil {
		e = *i.err
	}
	return
}

func (i *Wrapper) GetDataOrNil() interface{} { return i.getData() }

func NewWrapper(i interface{}) (rd *Wrapper) {
	rd = new(Wrapper)
	rd.dat = i
	rd.access = make([]string, 1, 1)
	rd.access[0] = "<root>"
	return rd
}

// NewObjectWrapper takes a Go object that has JSON field struct annotations
// and inserts it into a JSON wrapper. The serialization happens eagerly,
// and the object is copied into the wrapper, so that subsequent updates to the
// object will not be reflected in the Wrapper.
func NewObjectWrapper(i interface{}) (*Wrapper, error) {
	rd := NewDictionary()
	err := (NewWrapper(i)).UnmarshalAgain(&rd.dat)
	if err != nil {
		rd = nil
	}
	return rd, err
}

func NewDictionary() *Wrapper {
	m := make(map[string]interface{})
	return NewWrapper(m)
}

func NewArray(l int) *Wrapper {
	m := make([]interface{}, l)
	return NewWrapper(m)
}

func NewNil() *Wrapper {
	return NewWrapper(nil)
}

func NewInt(i int) *Wrapper {
	return NewWrapper(i)
}

func NewInt64(i int64) *Wrapper {
	return NewWrapper(i)
}

func NewFloat64(f float64) *Wrapper {
	return NewWrapper(f)
}

func NewUint64(u uint64) *Wrapper {
	return NewWrapper(u)
}

func NewString(s string) *Wrapper {
	return NewWrapper(s)
}

func NewBool(b bool) *Wrapper {
	return NewWrapper(b)
}

func isInt(v reflect.Value) bool {
	k := v.Kind()
	return k == reflect.Int || k == reflect.Int8 ||
		k == reflect.Int16 || k == reflect.Int32 ||
		k == reflect.Int64
}

func isUint(v reflect.Value) bool {
	k := v.Kind()
	return k == reflect.Uint || k == reflect.Uint8 ||
		k == reflect.Uint16 || k == reflect.Uint32 ||
		k == reflect.Uint64
}

func isFloat(v reflect.Value) bool {
	k := v.Kind()
	return k == reflect.Float32 || k == reflect.Float64
}

func (i *Wrapper) sameType(w *Wrapper) bool {
	return reflect.ValueOf(i.dat).Kind() == reflect.ValueOf(w.dat).Kind()
}

func (i *Wrapper) AccessPath() string {
	return strings.Join(i.access, "")
}

func (rd *Wrapper) GetFloat() (ret float64, err error) {
	if rd.err != nil {
		err = rd.err
	} else if n, ok := rd.dat.(json.Number); ok {
		ret, err = n.Float64()
	} else if v := reflect.ValueOf(rd.dat); isFloat(v) {
		ret = float64(v.Float())
	} else if isInt(v) {
		ret = float64(v.Int())
	} else if isUint(v) {
		ret = float64(v.Uint())
	} else {
		err = rd.wrongType("float-like", v.Kind())
	}
	return
}

func (w *Wrapper) GetFloatVoid(fp *float64, errp *error) {
	f, e := w.GetFloat()
	if e == nil {
		*fp = f
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) GetInt64() (ret int64, err error) {
	if rd.err != nil {
		err = rd.err
	} else if n, ok := rd.dat.(json.Number); ok {
		ret, err = n.Int64()
	} else if v := reflect.ValueOf(rd.dat); isInt(v) {
		ret = v.Int()
	} else if isFloat(v) {
		ret = int64(v.Float())
	} else if !isUint(v) {
		err = rd.wrongType("int", v.Kind())
	} else if v.Uint() <= (1<<63 - 1) {
		ret = int64(v.Uint())
	} else {
		err = rd.NewError("Signed int64 overflow error")
	}
	return
}

func (w *Wrapper) GetInt64Void(ip *int64, errp *error) {
	i, e := w.GetInt64()
	if e == nil {
		*ip = i
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) GetInt() (i int, err error) {
	i64, e := rd.GetInt64()
	return int(i64), e
}

func (w *Wrapper) GetIntVoid(ip *int, errp *error) {
	i, e := w.GetInt()
	if e == nil {
		*ip = i
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) GetUint() (u uint, err error) {
	u64, e := rd.GetUint64()
	return uint(u64), e
}

func (w *Wrapper) GetUintVoid(ip *uint, errp *error) {
	i, e := w.GetUint()
	if e == nil {
		*ip = i
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) GetUint64() (ret uint64, err error) {
	underflow := false
	if rd.err != nil {
		err = rd.err
	} else if n, ok := rd.dat.(json.Number); ok {
		var tmp int64
		if tmp, err = n.Int64(); err == nil && tmp < 0 {
			underflow = true
		} else if err == nil {
			ret = uint64(tmp)
		}
	} else if v := reflect.ValueOf(rd.dat); isUint(v) {
		ret = v.Uint()
	} else if isFloat(v) {
		if v.Float() < 0 {
			underflow = true
		} else {
			ret = uint64(v.Float())
		}
	} else if !isInt(v) {
		err = rd.wrongType("uint", v.Kind())
	} else if v.Int() >= 0 {
		ret = uint64(v.Int())
	} else {
		underflow = true
	}

	if underflow {
		err = rd.NewError("Unsigned uint64 underflow error")

	}
	return
}

func (w *Wrapper) GetUint64Void(ip *uint64, errp *error) {
	i, e := w.GetUint64()
	if e == nil {
		*ip = i
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) GetInterface() (v interface{}, err error) {
	if rd.err != nil {
		err = rd.err
	} else {
		v = rd.dat
	}
	return v, err
}

func (rd *Wrapper) GetBool() (ret bool, err error) {
	if rd.err != nil {
		err = rd.err
	} else {
		v := reflect.ValueOf(rd.dat)
		k := v.Kind()
		if k == reflect.Bool {
			ret = v.Bool()
		} else {
			err = rd.wrongType("bool", k)
		}
	}
	return
}

func (w *Wrapper) GetBoolVoid(bp *bool, errp *error) {
	b, e := w.GetBool()
	if e == nil {
		*bp = b
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) GetString() (ret string, err error) {
	if rd.err != nil {
		err = rd.err
	} else if v := reflect.ValueOf(rd.dat); v.Kind() == reflect.String {
		ret = v.String()
	} else if b, ok := rd.dat.([]uint8); ok {
		ret = string(b)
	} else if b, ok := rd.dat.([]byte); ok {
		ret = string(b)
	} else {
		err = rd.wrongType("string", v.Kind())
	}
	return
}

func (rd *Wrapper) GetBytes() (ret []byte, err error) {
	if rd.err != nil {
		err = rd.err
	} else if b, ok := rd.dat.([]byte); ok {
		ret = b
	} else {
		err = rd.wrongType("[]byte", reflect.ValueOf(rd.dat).Kind())
	}
	return
}

func (w *Wrapper) GetBytesVoid(bp *[]byte, errp *error) {
	b, e := w.GetBytes()
	if e == nil {
		*bp = b
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (w *Wrapper) GetStringVoid(sp *string, errp *error) {
	s, e := w.GetString()
	if e == nil {
		*sp = s
	} else if e != nil && errp != nil && *errp == nil {
		*errp = e
	}
}

func (rd *Wrapper) AtIndex(i int) *Wrapper {
	ret, v := rd.asArray()
	if v == nil {

	} else if i < 0 {
		ret.err = rd.NewError("index out of bounds %d < 0", i)
	} else if len(v) <= i {
		ret.err = rd.NewError("index out of bounds %d >= %d", i, len(v))
	} else {
		ret.dat = v[i]
	}
	ret.access = append(ret.access, fmt.Sprintf("[%d]", i))
	return ret
}

func (rd *Wrapper) Len() (ret int, err error) {
	tmp, v := rd.asArray()
	if v == nil {
		err = tmp.err
	} else {
		ret = len(v)
	}
	return
}

func (i *Wrapper) Keys() (v []string, err error) {
	tmp, d := i.asDictionary()
	if d == nil {
		err = tmp.err
	} else {
		v = make([]string, len(d))
		var i int = 0
		for k, _ := range d {
			v[i] = k
			i++
		}
	}
	return
}

func (i *Wrapper) asArray() (ret *Wrapper, v []interface{}) {
	if i.err != nil {
		ret = i
	} else {
		var ok bool
		v, ok = (i.dat).([]interface{})
		ret = new(Wrapper)
		ret.access = i.access
		if !ok {
			ret.err = i.wrongType("array", reflect.ValueOf(i.dat).Kind())
		}
	}
	return
}

func (rd *Wrapper) IsNil() bool {
	return rd.dat == nil
}

func (rd *Wrapper) AtKey(s string) *Wrapper {
	ret, d := rd.asDictionary()

	ret.access = append(ret.access, fmt.Sprintf(".%s", s))
	if d != nil {
		val, found := d[s]
		if found {
			ret.dat = val
		} else {
			ret.dat = nil
			ret.err = ret.NewError("no such key: %s", s)
		}
	}
	return ret
}

func (rd *Wrapper) ToDictionary() (out *Wrapper, e error) {
	tmp, _ := rd.asDictionary()
	if tmp.err != nil {
		e = tmp.err
	} else {
		out = rd
	}
	return
}

func (rd *Wrapper) ToArray() (out *Wrapper, e error) {
	tmp, _ := rd.asArray()
	if tmp.err != nil {
		e = tmp.err
	} else {
		out = rd
	}
	return
}

func (w *Wrapper) SetKey(s string, val *Wrapper) error {
	b, d := w.asDictionary()
	if d != nil {
		d[s] = val.getData()
	}
	return b.Error()
}

func (w *Wrapper) DeleteKey(s string) error {
	b, d := w.asDictionary()
	if d != nil {
		delete(d, s)
	}
	return b.Error()
}

func (w *Wrapper) SetIndex(i int, val *Wrapper) error {
	b, d := w.asArray()
	if d != nil {
		d[i] = val.getData()
	}
	return b.Error()

}

func (i *Wrapper) asDictionary() (ret *Wrapper, d map[string]interface{}) {
	if i.err != nil {
		ret = i
	} else {
		var ok bool
		d, ok = (i.dat).(map[string]interface{})
		ret = new(Wrapper)
		ret.access = i.access
		if !ok {
			ret.err = i.wrongType("dict", reflect.ValueOf(i.dat).Kind())
		}
	}
	return
}

func tryInt(bit string) (ret int, isInt bool) {
	ret = 0
	isInt = false
	if len(bit) > 0 && (bit[0] >= '0' && bit[0] <= '9') {
		// this is probably an int, use AtIndex instead
		var e error
		ret, e = strconv.Atoi(bit)
		isInt = (e == nil)
	}
	return
}

func (w *Wrapper) AtPath(path string) (ret *Wrapper) {
	bits := strings.Split(path, ".")
	ret = w
	for _, bit := range bits {
		if val, isInt := tryInt(bit); isInt {
			ret = ret.AtIndex(val)
		} else if len(bit) > 0 {
			ret = ret.AtKey(bit)
		} else {
			break
		}

		if ret.dat == nil || ret.err != nil {
			break
		}
	}
	return ret
}

func (w *Wrapper) AtPathGetInt(path string) (ret int, ok bool) {
	tmp := w.AtPath(path)
	if tmp != nil {
		var err error
		ret, err = tmp.GetInt()
		ok = (err == nil)
	} else {
		ok = false
	}
	return
}

func (w *Wrapper) SetValueAtPath(path string, value *Wrapper) error {
	bits := strings.Split(path, ".")
	currW := w
	var err error
	for i, bit := range bits {
		// at each key, create an empty dictionary if one doesn't exist yet
		var nextVal, d *Wrapper
		// if the next bit is an integer, and it's not the last key
		// in the path, then the next value should be an array
		if i == len(bits)-1 {
			nextVal = value
		} else if nextInt, nextIsInt := tryInt(bits[i+1]); nextIsInt {
			// Default size of the array is just big enough to fit the next
			// value.
			nextVal = NewArray(nextInt + 1)
		} else {
			nextVal = NewDictionary()
		}

		// If we're looking at an index, treat like an array
		if val, is_int := tryInt(bit); is_int {
			d = currW.AtIndex(val)
		} else {
			d = currW.AtKey(bit)
		}

		// if we've hit nil or a wrong type of node, or the last bit,
		// write in the correct value
		if d.IsNil() || !d.sameType(nextVal) || i == len(bits)-1 {
			d = nextVal
			if val, is_int := tryInt(bit); is_int {
				// TODO: resize array if it's not big enough?
				err = currW.SetIndex(val, d)
			} else {
				err = currW.SetKey(bit, d)
			}
			if err != nil {
				return err
			}
		}

		currW = d
	}

	return err
}

func (w *Wrapper) DeleteValueAtPath(path string) error {
	bits := strings.Split(path, ".")
	currW := w
	var err error
	for _, bit := range bits[:len(bits)-1] {
		//  if the any key on the path doesn't exist yet, we're done
		// If we're looking at an index, treat like an array
		var d *Wrapper
		if val, is_int := tryInt(bit); is_int {
			d = currW.AtIndex(val)
		} else {
			d = currW.AtKey(bit)
		}

		if d.IsNil() {
			return nil
		}

		currW = d
	}

	lastBit := bits[len(bits)-1]
	if val, is_int := tryInt(lastBit); is_int {
		// can't do much for arrays besides just make it nil
		err = currW.SetIndex(val, NewNil())
	} else {
		err = currW.DeleteKey(lastBit)
	}
	return err
}

func (w *Wrapper) UnmarshalAgain(i interface{}) (err error) {
	var tmp []byte
	if tmp, err = w.Marshal(); err != nil {
		return
	}
	err = json.Unmarshal(tmp, i)
	return
}

func Canonicalize(in []byte) ([]byte, error) {
	if v, err := Unmarshal(in); err != nil {
		return nil, err
	} else if ret, err := v.Marshal(); err != nil {
		return nil, err
	} else {
		return ret, nil
	}
}

func (w *Wrapper) AssertEqAtPath(path string, obj *Wrapper, errp *error) {
	v := w.AtPath(path)
	if b1, err := v.Marshal(); err != nil {
		*errp = err
	} else if b2, err := w.Marshal(); err != nil {
		*errp = err
	} else if !bytes.Equal(b1, b2) {
		err = fmt.Errorf("Equality assertion failed at %s: %s != %s",
			path, string(b1), string(b2))
	}
	return
}

const JSONEscape = byte('\\')
const JSONDoubleQuotationMark = byte('"')
const JSONLeftSquareBracket = byte('[')
const JSONLeftCurlyBracket = byte('{')
const JSONRightSquareBracket = byte(']')
const JSONRightCurlyBracket = byte('}')

// ensureMaxDepth returns an error if raw represents a valid JSON string whose
// deserialization's maximum depth exceeds maxDepth.
// If raw represents an invalid JSON string with a prefix that is a valid JSON prefix
// whose depth exceeds maxDepth, an error will be returned as well).
// See https://github.com/golang/go/blob/master/src/encoding/json/decode.go#L96.
// Otherwise, behavior is undefined and an error may or may not be returned.
// See the spec at https://json.org.
func EnsureMaxDepth(unsafeRawReader *bufio.Reader, maxDepth int) error {
	depth := 1
	inString := false
	lastByteWasEscape := false
	for {
		b, err := unsafeRawReader.ReadByte()
		switch err {
		case io.EOF:
			return nil
		case nil:
		default:
			return err
		}
		if depth >= maxDepth {
			return DepthError{fmt.Sprintf("Invalid JSON or exceeds max depth %d.", maxDepth)}
		}
		if inString {
			if lastByteWasEscape {
				// i.e., if the last byte was an escape, we are no longer in an
				// escape sequence. This is not strictly true: JSON unicode codepoint
				// escape sequences are of the form \uXXXX where X is a hexadecimal
				// character. However since X cannot be JSONEscape or JSONDoubleQuotationMark
				// in valid JSON, there is no problem: later there will be an
				// error parsing the JSON and this will occur before maxDepth
				// is reached in the JSON parser.
				lastByteWasEscape = false
			} else if b == JSONEscape {
				lastByteWasEscape = true
			} else if b == JSONDoubleQuotationMark {
				inString = false
			}
		} else {
			switch b {
			case JSONDoubleQuotationMark:
				inString = true
			case JSONLeftSquareBracket, JSONLeftCurlyBracket:
				depth += 1
			case JSONRightSquareBracket, JSONRightCurlyBracket:
				depth -= 1
			}
		}
	}
}

func EnsureMaxDepthDefault(unsafeRawReader *bufio.Reader) error {
	return EnsureMaxDepth(unsafeRawReader, defaultMaxDepth)
}

func EnsureMaxDepthBytesDefault(unsafeRaw []byte) error {
	return EnsureMaxDepthDefault(bufio.NewReader(bytes.NewReader(unsafeRaw)))
}
