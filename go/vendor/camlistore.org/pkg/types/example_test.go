package types

import (
	"expvar"
	"fmt"
	"io"
	"io/ioutil"
	"strings"
)

func ExampleNewStatsReader() {
	var (
		// r is the io.Reader we'd like to count read from.
		r  = strings.NewReader("Hello world")
		v  = expvar.NewInt("read-bytes")
		sw = NewStatsReader(v, r)
	)
	// Read from the wrapped io.Reader, StatReader will count the bytes.
	io.Copy(ioutil.Discard, sw)
	fmt.Printf("Read %s bytes\n", v.String())
	// Output: Read 11 bytes
}
