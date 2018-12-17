package msgpackzip

import (
	"bytes"
	"compress/flate"
	"io/ioutil"
)

func flateCompress(b []byte) ([]byte, error) {
	var buf bytes.Buffer
	zw, err := flate.NewWriter(&buf, flate.DefaultCompression)
	if err != nil {
		return nil, err
	}
	_, err = zw.Write(b)
	if err != nil {
		return nil, err
	}
	err = zw.Close()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func flateInflate(b []byte) ([]byte, error) {
	buf := bytes.NewBuffer(b)
	zr := flate.NewReader(buf)
	return ioutil.ReadAll(zr)
}
