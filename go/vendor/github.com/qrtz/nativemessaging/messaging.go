package nativemessaging

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"io/ioutil"
)

var (

	// ErrInvalidMessageSize unable to read message size
	ErrInvalidMessageSize = errors.New("Invalid message size")
	// ErrByteOrderNotSet byter order is set on the first read
	ErrByteOrderNotSet = errors.New("Byte order not set")
	messageSizeInBytes = binary.Size(uint32(0))
)

// Writer is an interface that wraps the Write method.
type Writer interface {
	// Write writes bytes from the given io.Reader to the underlying io.Writer
	// It returns the number of bytes from io.Reader and any error from the write operation.
	Write(io.Reader) (int, error)
}

// Reader is an interface that wraps the Read method.
type Reader interface {
	// Read reads bytes from an io.Reader.
	// It returns the bytes read and an error from the read operation.
	// Read may return io.EOF when the underlying stream reach the end or is closed
	Read() ([]byte, error)
}

// JSONEncoder writes JSON values to an output stream.
type JSONEncoder interface {
	Encode(interface{}) error
}

// JSONDecoder reads and decodes JSON values from an input stream.
type JSONDecoder interface {
	Decode(interface{}) error
}

type writer struct {
	w  io.Writer
	bo binary.ByteOrder
}

// NewWriter returns a new writer that writes to w
// The data is preceded with 32-bit data length in the specified byte order
func NewWriter(w io.Writer, bo binary.ByteOrder) Writer {
	return &writer{
		w:  w,
		bo: bo,
	}
}

// NewNativeWriter returns a new writer that writes to the given io.Writer
// The data is preceded with 32-bit data length in native byte order
func NewNativeWriter(w io.Writer) Writer {
	return &writer{
		w:  w,
		bo: NativeEndian,
	}
}

func (w *writer) Write(r io.Reader) (int, error) {
	return Write(w.w, r, w.bo)
}

type reader struct {
	r  io.Reader
	bo binary.ByteOrder
}

// NewReader returns a new reader that reads from the given io.Reader
// interpreting the first 4 bytes as 32-bit data length in the specified byte order
func NewReader(r io.Reader, bo binary.ByteOrder) Reader {
	return &reader{
		r:  r,
		bo: bo,
	}
}

// NewNativeReader returns a new reader that reads from the given io.Reader
// interpreting the first 4 bytes as 32-bit data length in native byte order
func NewNativeReader(r io.Reader) Reader {
	return &reader{
		r:  r,
		bo: NativeEndian,
	}
}

func (r *reader) Read() ([]byte, error) {
	return Read(r.r, r.bo)
}

type jsonEncoder struct {
	w  io.Writer
	bo binary.ByteOrder
}

// NewJSONEncoder returns a new jsonEncoder that write to the given io.Writer
// The data is preceded with 32-bit data length in the specified byte order
func NewJSONEncoder(w io.Writer, bo binary.ByteOrder) JSONEncoder {
	return &jsonEncoder{
		w:  w,
		bo: bo,
	}
}

// NewNativeJSONEncoder returns a new jsonEncoder that writes to the given io.Writer
// The data is preceded with 32-bit data length in native byte order
func NewNativeJSONEncoder(w io.Writer) JSONEncoder {
	return &jsonEncoder{
		w:  w,
		bo: NativeEndian,
	}
}

func (e *jsonEncoder) Encode(v interface{}) error {
	_, err := Encode(e.w, v, e.bo)
	return err
}

type jsonDecoder struct {
	r  io.Reader
	bo binary.ByteOrder
}

// NewJSONDecoder returns a new jsonDecoder that reads from the given io.Reader
// interpreting the first 4 bytes as 32-bit data length in the specified byte order
func NewJSONDecoder(r io.Reader, bo binary.ByteOrder) JSONDecoder {
	return &jsonDecoder{
		r:  r,
		bo: bo,
	}
}

// NewNativeJSONDecoder returns a new jsonDecoder that reads from the given io.Reader
// interpreting the first 4 bytes as 32-bit data length in native byte order
func NewNativeJSONDecoder(r io.Reader) JSONDecoder {
	return &jsonDecoder{
		r:  r,
		bo: NativeEndian,
	}
}

func (d *jsonDecoder) Decode(v interface{}) error {
	return Decode(d.r, v, d.bo)
}

type host struct {
	r  io.Reader
	w  io.Writer
	bo binary.ByteOrder
}

func (h *host) Read() ([]byte, error) {
	return Read(h.r, h.bo)
}

func (h *host) Write(message io.Reader) (int, error) {
	return Write(h.w, message, h.bo)
}

func (h *host) Send(v interface{}) (int, error) {
	return Encode(h.w, v, h.bo)

}
func (h *host) Receive(v interface{}) error {
	return Decode(h.r, v, h.bo)
}

// Read reads a message from the given io.Reader interpreting the
// leading first 4 bytes as a 32-bit unsigned integer encoded in the specified byte order
func Read(r io.Reader, order binary.ByteOrder) ([]byte, error) {
	b := make([]byte, messageSizeInBytes)
	i, err := r.Read(b)
	if err != nil {
		return nil, err
	}
	if i == 0 {
		return nil, ErrInvalidMessageSize
	}

	ln := order.Uint32(b)

	if ln == 0 {
		return nil, ErrInvalidMessageSize
	}
	m := make([]byte, ln)
	_, err = r.Read(m)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// Decode parses the incoming JSON-encoded data and stores the result in the value pointed to by v.
// The leading first 4 bytes of the data is interpreted as a 32-bit unsigned integer encoded in the specified byte order
func Decode(r io.Reader, v interface{}, order binary.ByteOrder) error {
	b, err := Read(r, order)
	if err != nil {
		return err
	}
	err = json.Unmarshal(b, v)
	if err != nil {
		return errors.New(err.Error() + string(b))
	}
	return nil
}

// Write writes to io.Writer the data read from the given io.Reader
// The data is preceded with a 32-bit unsigned integer data length in the specified byte order
func Write(w io.Writer, message io.Reader, order binary.ByteOrder) (i int, err error) {
	data, err := ioutil.ReadAll(message)
	if err != nil {
		return 0, err
	}

	header := make([]byte, messageSizeInBytes)
	order.PutUint32(header, uint32(len(data)))
	return w.Write(append(header, data...))
}

// Encode writes to io.Writer the json encoded data of the given value
// The data is preceded with a 32-bit unsigned integer data length in the specified byte order
func Encode(w io.Writer, v interface{}, order binary.ByteOrder) (int, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return 0, err
	}
	return Write(w, bytes.NewReader(b), order)
}
