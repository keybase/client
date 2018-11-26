package msgpackzip

import (
	"bytes"
	"fmt"
	"sort"
)

type compressor struct {
	input          []byte
	valueWhitelist ValueWhitelist
	collectMapKeys bool
}

func newCompressor(b []byte, wl ValueWhitelist, c bool) *compressor {
	return &compressor{input: b, valueWhitelist: wl, collectMapKeys: c}
}

// ValueWhitelist can be used to specify which values can be compressed.
// Values are either strings or binary []byte arrays.
type ValueWhitelist struct {
	strings     map[string]bool
	binaries    map[string]bool
	allValuesOk bool
}

// NewValueWhitelist makes an empty value white list, initialzed with empty
// lists.
func NewValueWhitelist() *ValueWhitelist {
	return &ValueWhitelist{
		strings:  make(map[string]bool),
		binaries: make(map[string]bool),
	}
}

// AddString adds a string to the value whitelist
func (v *ValueWhitelist) AddString(s string) {
	v.strings[s] = true
}

// AddBinary adds a binary buffer to the value whitelist
func (v *ValueWhitelist) AddBinary(b []byte) {
	v.binaries[string(b)] = true
}

func (v *ValueWhitelist) hasString(s string) bool {
	if v.allValuesOk {
		return true
	}
	return v.strings[s]
}

func (v *ValueWhitelist) hasBinary(b []byte) bool {
	if v.allValuesOk {
		return true
	}
	return v.binaries[string(b)]
}

// CompressWithWhitelist takes as input a msgpack encoded payload,
// and also a whitelist of values that it's OK to compress.  It then compresses
// all map keys and values in the given whitelist, and returns a compression,
// or an error on error.
func CompressWithWhitelist(input []byte, wl ValueWhitelist) (output []byte, err error) {
	return newCompressor(input, wl, true).run()
}

// Compress the given msgpack encoding, compressing only static map keys, and
// not compressing any values.
func Compress(input []byte) (output []byte, err error) {
	return newCompressor(input, *NewValueWhitelist(), true).run()
}

// ReportValuesFrequencies takes as input a msgpack encoding, and reports
// which values are the most fequent in the encoding. It returns a list
// of Frequency objects, sorted from most frequent to least frequent.
func ReportValuesFrequencies(input []byte) (ret []Frequency, err error) {
	wl := NewValueWhitelist()
	wl.allValuesOk = true
	return newCompressor(input, *wl, false).collectAndSortFrequencies()
}

// collectAndSortFrequencies decodes and descends the input buffer, making
// an list of frequencies of map keys (and values if we have an active whitelist)
// and returns a sorted list of those values, from most frequent to least frequent.
func (c *compressor) collectAndSortFrequencies() (ret []Frequency, err error) {

	freqs, err := c.collectFrequencies()
	if err != nil {
		return nil, err
	}
	freqsSorted, err := c.sortFrequencies(freqs)
	if err != nil {
		return nil, err
	}
	return freqsSorted, nil
}

// run the compressor on the given input. Can be used only once
// per instantiation of compressor object.
func (c *compressor) run() (output []byte, err error) {

	freqsSorted, err := c.collectAndSortFrequencies()
	if err != nil {
		return nil, err
	}
	keys, err := c.frequenciesToMap(freqsSorted)
	if err != nil {
		return nil, err
	}
	output, err = c.output(freqsSorted, keys)
	return output, err
}

// BinaryMapKey is a wrapper around a []byte vector of binary data so that it
// can be stored as an interface{} and differentiated from proper strings.
type BinaryMapKey string

// collectFrequencies descends the input msgpack encoding and collects
// the frequencies of map keys and values on the white list. It returns a map
// of (key or value) to the number of times it shows up in the object.
// The map is of type `map[interface{}]int`, which the `interface{}` can
// be an int64, a plain old string, or a binary []byte buffer wrapped in a
// BinaryMapKey.
func (c *compressor) collectFrequencies() (ret map[interface{}]int, err error) {

	ret = make(map[interface{}]int)
	hooks := msgpackDecoderHooks{
		mapKeyHook: func(d decodeStack) (decodeStack, error) {
			d.hooks = msgpackDecoderHooks{
				stringHook: func(l msgpackInt, s string) error {
					if c.collectMapKeys {
						ret[s]++
					}
					return nil
				},
				intHook: func(l msgpackInt) error {
					i, err := l.toInt64()
					if err != nil {
						return err
					}
					if c.collectMapKeys {
						ret[i]++
					}
					return nil
				},
				fallthroughHook: func(i interface{}, s string) error {
					return fmt.Errorf("bad map key (type %T)", i)
				},
			}
			return d, nil
		},
		stringHook: func(l msgpackInt, s string) error {
			if c.valueWhitelist.hasString(s) {
				ret[s]++
			}
			return nil
		},
		binaryHook: func(l msgpackInt, b []byte) error {
			s := string(b)
			if c.valueWhitelist.hasBinary(b) {
				ret[BinaryMapKey(s)]++
			}
			return nil
		},
	}
	err = newMsgpackDecoder(bytes.NewReader(c.input)).run(hooks)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

// Frequency is a tuple, with a `Key interface{}` that can be an int64, a string,
// or a BinaryMapKey (which is a wrapper around a binary buffer). The `Freq` field
// is a count for how many times the `Key` shows up in the encoded msgpack object.
type Frequency struct {
	Key  interface{}
	Freq int
}

// sortFrequencies converts a map of (keys -> counts) into an ordered vector of frequencies.
func (c *compressor) sortFrequencies(freqs map[interface{}]int) (ret []Frequency, err error) {

	ret = make([]Frequency, len(freqs))
	var i int
	for k, v := range freqs {
		ret[i] = Frequency{k, v}
		i++
	}
	sort.SliceStable(ret, func(i, j int) bool { return ret[i].Freq > ret[j].Freq })
	return ret, nil
}

// frequenciesToMap converts a sorted vectors of frequencies to a map (key -> uint),
// where the RHS values are ordered 0 to N. The idea is that the most frequent
// keys get ths smallest values, which take of the least space when msgpack encoded.
// This function returns the "keyMap" refered to later.
func (c *compressor) frequenciesToMap(freqs []Frequency) (keys map[interface{}]uint, err error) {
	ret := make(map[interface{}]uint, len(freqs))
	for i, freq := range freqs {
		ret[freq.Key] = uint(i)
	}
	return ret, nil
}

// output the data, the compressed keymap, and the version byte, which is the whole
// encodeded compressed output.
func (c *compressor) output(freqsSorted []Frequency, keys map[interface{}]uint) (output []byte, err error) {

	version := Version(1)
	data, err := c.outputData(keys)
	if err != nil {
		return nil, err
	}
	compressedKeymap, err := c.outputCompressedKeymap(freqsSorted)
	if err != nil {
		return nil, err
	}
	return c.outputFinalProduct(version, data, compressedKeymap)
}

// outputData, replacing all map Keys with their corresponding uints in the
// keyMap. If we come across white-listed values, replace them with an
// "external marker", followed by their position in the keyMap.
func (c *compressor) outputData(keys map[interface{}]uint) (output []byte, err error) {

	var data outputter

	hooks := data.decoderHooks()

	// mapKeys are rewritten to be uints that appear in the
	// keyMap passed in.
	hooks.mapKeyHook = func(d decodeStack) (decodeStack, error) {
		d.hooks = msgpackDecoderHooks{
			intHook: func(l msgpackInt) error {
				i, err := l.toInt64()
				if err != nil {
					return err
				}
				val, ok := keys[i]
				if !ok {
					return fmt.Errorf("unexpected map key: %v", i)
				}
				return data.outputRawUint(val)
			},
			stringHook: func(l msgpackInt, s string) error {
				val, ok := keys[s]
				if !ok {
					return fmt.Errorf("unexpected map key: %q", s)
				}
				return data.outputRawUint(val)
			},
			fallthroughHook: func(i interface{}, s string) error {
				return fmt.Errorf("bad map key (type %T)", i)
			},
		}
		return d, nil
	}

	// strings are rewritten if they are on the whitelist
	hooks.stringHook = func(l msgpackInt, s string) error {
		val, ok := keys[s]
		if ok {
			return data.outputExtUint(val)
		}
		return data.outputString(l, s)
	}

	// binary buffers are rewritten if they are on the whitelist
	hooks.binaryHook = func(l msgpackInt, b []byte) error {
		val, ok := keys[BinaryMapKey(string(b))]
		if ok {
			return data.outputExtUint(val)
		}
		return data.outputBinary(l, b)
	}

	// external data types are output and aren't allowed in inputs
	hooks.extHook = func(b []byte) error {
		return fmt.Errorf("cannot handle external data types")
	}

	err = newMsgpackDecoder(bytes.NewReader(c.input)).run(hooks)
	if err != nil {
		return nil, err
	}

	return data.Bytes(), nil
}

// outputCompressedKeymap msgpack encodes the keymap and then runs
// `flate.Compress` on the output (which is gzip without the headers).
// We're hand-encoding this map using our msgpack encoder. Note that we're
// not compressing the keymap directly, but rather the frequence array
// that we derive the keymap from. This is so that we get determinstic
// output, since ranging of a map in Go is non-deterministic and randomized.
func (c *compressor) outputCompressedKeymap(freqsSorted []Frequency) (output []byte, err error) {

	var keymap outputter

	// Now write out a msgpack dictionary for the keymaps;
	// do it but hand, that's simplest for now, rather than pulling
	// in a new encoder.
	err = keymap.outputMapPrefix(msgpackIntFromUint(uint(len(freqsSorted))))
	if err != nil {
		return nil, err
	}
	for i, v := range freqsSorted {
		// Note that we reverse the map to make decoding easier
		err = keymap.outputInt(msgpackIntFromUint(uint(i)))
		if err != nil {
			return nil, err
		}
		err = keymap.outputStringOrUintOrBinary(v.Key)
		if err != nil {
			return nil, err
		}
	}
	tmp := keymap.Bytes()

	compressedKeymap, err := flateCompress(tmp)
	if err != nil {
		return nil, err
	}

	return compressedKeymap, nil
}

type Version int

// outputFinalProduct is the final pass output routine. It outputs the wrapper
// 3-value array, the version prefix, the encoded data, and the compressed, encoded
// keyMap.
func (c *compressor) outputFinalProduct(version Version, data []byte, compressedKeymap []byte) (output []byte, err error) {

	var ret outputter

	// 3 elements in the array, so output '3'
	err = ret.outputArrayPrefix(msgpackIntFromUint(uint(3)))
	if err != nil {
		return nil, err
	}
	err = ret.outputInt(msgpackIntFromUint(uint(version)))
	if err != nil {
		return nil, err
	}
	err = ret.outputBinary(msgpackIntFromUint(uint(len(data))), data)
	if err != nil {
		return nil, err
	}
	err = ret.outputBinary(msgpackIntFromUint(uint(len(compressedKeymap))), compressedKeymap)
	if err != nil {
		return nil, err
	}

	return ret.Bytes(), nil
}
