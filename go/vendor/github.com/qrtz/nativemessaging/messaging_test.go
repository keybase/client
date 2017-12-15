package nativemessaging

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"strings"
	"testing"
)

// Test writer
func write(t *testing.T, endian binary.ByteOrder) {
	var w Writer
	buf := new(bytes.Buffer)
	value := "native message host"
	if endian == nil {
		w = NewNativeWriter(buf)
	} else {
		w = NewWriter(buf, endian)
	}
	i, err := w.Write(strings.NewReader(value))

	if err != nil {
		t.Fatal(err)
	}

	if i != len(value)+binary.Size(uint32(0)) {
		t.Fatal("Invalid write length")
	}

	result := buf.String()[4:]
	if result != value {
		t.Fatalf("Expected: %s Got: %s", value, result)
	}
}

func testWriter(t *testing.T, endian binary.ByteOrder) {
	var w Writer
	buf := new(bytes.Buffer)
	value := "native message host"
	if endian == nil {
		w = NewNativeWriter(buf)
	} else {
		w = NewWriter(buf, endian)
	}
	i, err := w.Write(strings.NewReader(value))

	if err != nil {
		t.Fatal(err)
	}

	if i != len(value)+binary.Size(uint32(0)) {
		t.Fatal("Invalid write length")
	}

	result := buf.String()[4:]
	if result != value {
		t.Fatalf("Expected: %s Got: %s", value, result)
	}
}

func testJSONEncoder(t *testing.T, endian binary.ByteOrder) {
	var encoder JSONEncoder
	value := struct{ Text string }{Text: "native messaging host"}
	buf := new(bytes.Buffer)

	if endian == nil {
		encoder = NewNativeJSONEncoder(buf)
	} else {
		encoder = NewJSONEncoder(buf, endian)
	}

	err := encoder.Encode(value)
	if err != nil {
		t.Fatal(err)
	}

	var result struct{ Text string }

	err = json.Unmarshal(buf.Bytes()[binary.Size(uint32(0)):], &result)
	if err != nil {
		t.Fatal(err)
	}
	if result.Text != value.Text {
		t.Fatalf("Invalid result: %s", buf)
	}
}
func testJSONDecoder(t *testing.T, endian binary.ByteOrder) {
	var decoder JSONDecoder
	value := struct{ Text string }{Text: "native messaging host"}
	b, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	header := make([]byte, binary.Size(uint32(0)))
	if endian == nil {
		endian = NativeEndian
		endian.PutUint32(header, uint32(len(b)))
		decoder = NewNativeJSONDecoder(bytes.NewReader(append(header, b...)))
	} else {
		endian.PutUint32(header, uint32(len(b)))
		decoder = NewJSONDecoder(bytes.NewReader(append(header, b...)), endian)
	}
	var result struct{ Text string }
	err = decoder.Decode(&result)

	if err != nil {
		t.Fatal(err)
	}

	if result.Text != value.Text {
		t.Fatalf("Invalid result: %#v", result)
	}
}

func TestNativeJSONEncoder(t *testing.T) {
	testJSONEncoder(t, nil)
}

func TestBigEndianJSONEncoder(t *testing.T) {
	testJSONEncoder(t, binary.BigEndian)
}

func TestLittleEndianJSONEncoder(t *testing.T) {
	testJSONEncoder(t, binary.LittleEndian)
}

func TestNativeJSONDecoder(t *testing.T) {
	testJSONDecoder(t, nil)
}

func TestBigEndianJSONDecoder(t *testing.T) {
	testJSONDecoder(t, binary.BigEndian)
}

func TestLittleEndianJSONDecoder(t *testing.T) {
	testJSONDecoder(t, binary.LittleEndian)
}

func TestWriteNativeEndian(t *testing.T) {
	write(t, nil)
}

func TestWriteLittleEndian(t *testing.T) {
	write(t, binary.LittleEndian)
}

func TestWriteBigEndian(t *testing.T) {
	write(t, binary.BigEndian)
}
func TestNativeEndianWriter(t *testing.T) {
	testWriter(t, nil)
}

func TestLittleEndianWriter(t *testing.T) {
	testWriter(t, binary.LittleEndian)
}

func TestBigEndianWriter(t *testing.T) {
	testWriter(t, binary.BigEndian)
}

// Test JSONEncoder
func encode(t *testing.T, endian binary.ByteOrder) {
	var encoder JSONEncoder
	value := struct{ Text string }{Text: "native messaging host"}
	buf := new(bytes.Buffer)

	if endian == nil {
		encoder = NewNativeJSONEncoder(buf)
	} else {
		encoder = NewJSONEncoder(buf, endian)
	}

	err := encoder.Encode(value)
	if err != nil {
		t.Fatal(err)
	}

	var result struct{ Text string }

	err = json.Unmarshal(buf.Bytes()[binary.Size(uint32(0)):], &result)
	if err != nil {
		t.Fatal(err)
	}
	if result.Text != value.Text {
		t.Fatalf("Invalid result: %s", buf)
	}
}
func TestSendNativeEndian(t *testing.T) {
	encode(t, nil)
}

func TestSendLittleEndian(t *testing.T) {
	encode(t, binary.LittleEndian)
}

func TestSendBigEndian(t *testing.T) {
	encode(t, binary.BigEndian)
}

// Test Reader
func read(t *testing.T, endian binary.ByteOrder) {
	var reader Reader
	value := struct{ Text string }{Text: "native messaging host"}
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	header := make([]byte, binary.Size(uint32(0)))

	if endian == nil {
		endian = NativeEndian
		endian.PutUint32(header, uint32(len(data)))
		reader = NewNativeReader(bytes.NewReader(append(header, data...)))
	} else {
		endian.PutUint32(header, uint32(len(data)))
		reader = NewReader(bytes.NewReader(append(header, data...)), endian)
	}

	result, err := reader.Read()

	if err != nil {
		t.Fatal(err)
	}

	if string(result) != string(data) {
		t.Fatalf("Got: %s: Expected: %s", string(data), string(result))
	}
}
func testReader(t *testing.T, endian binary.ByteOrder) {
	var r Reader

	value := struct{ Text string }{Text: "native messaging host"}
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	header := make([]byte, binary.Size(uint32(0)))

	if endian == nil {
		endian = NativeEndian
		endian.PutUint32(header, uint32(len(data)))
		r = NewNativeReader(bytes.NewReader(append(header, data...)))
	} else {
		endian.PutUint32(header, uint32(len(data)))
		r = NewReader(bytes.NewReader(append(header, data...)), endian)
	}

	result, err := r.Read()

	if err != nil {
		t.Fatal(err)
	}

	if string(result) != string(data) {
		t.Fatalf("Got: %s: Expected: %s", string(data), string(result))
	}
}

func TestReadNativeEndian(t *testing.T) {
	read(t, nil)
}

func TestReadLittleEndian(t *testing.T) {
	read(t, binary.LittleEndian)
}

func TestReadBigEndian(t *testing.T) {
	read(t, binary.BigEndian)
}

func TestNativeEndianReader(t *testing.T) {
	testReader(t, nil)
}

func TestLittleEndianReader(t *testing.T) {
	testReader(t, binary.LittleEndian)
}

func TestBigEndianReader(t *testing.T) {
	testReader(t, binary.BigEndian)
}

// Test JSONDecoder
func decode(t *testing.T, endian binary.ByteOrder) {
	var decoder JSONDecoder
	value := struct{ Text string }{Text: "native messaging host"}
	b, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	header := make([]byte, binary.Size(uint32(0)))
	if endian == nil {
		endian = NativeEndian
		endian.PutUint32(header, uint32(len(b)))
		decoder = NewNativeJSONDecoder(bytes.NewReader(append(header, b...)))
	} else {
		endian.PutUint32(header, uint32(len(b)))
		decoder = NewJSONDecoder(bytes.NewReader(append(header, b...)), endian)
	}
	var result struct{ Text string }
	err = decoder.Decode(&result)

	if err != nil {
		t.Fatal(err)
	}

	if result.Text != value.Text {
		t.Fatalf("Invalid result: %#v", result)
	}
}

func TestReceiveNativeEndian(t *testing.T) {
	decode(t, nil)
}

func TestReceiveLittleEndian(t *testing.T) {
	decode(t, binary.LittleEndian)
}

func TestReceiveBigEndian(t *testing.T) {
	decode(t, binary.BigEndian)
}
