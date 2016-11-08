package chat

import (
	"encoding/gob"
	"os"
	"path/filepath"
)

type AttachmentStash interface {
	Start(filename, s3path string) error
	Lookup(filename string) (string, error)
	Stop(filename string) error
}

type FileStash struct{}

func NewFileStash() *FileStash {
	return &FileStash{}
}

func (f *FileStash) Start(filename, s3path string) error {
	c, err := f.contents()
	if err != nil {
		return err
	}
	c[filename] = s3path

	return f.serialize(c)
}

func (f *FileStash) Lookup(filename string) (string, error) {
	c, err := f.contents()
	if err != nil {
		return "", err
	}
	return c[filename], nil
}

func (f *FileStash) Stop(filename string) error {
	c, err := f.contents()
	if err != nil {
		return err
	}
	delete(c, filename)
	return f.serialize(c)
}

func (f *FileStash) filename() string {
	return filepath.Join(os.TempDir(), "chat_attachment_starts")
}

func (f *FileStash) contents() (map[string]string, error) {
	x, err := os.Open(f.filename())
	if err != nil {
		if os.IsNotExist(err) {
			return make(map[string]string), nil
		}
		return nil, err
	}
	defer x.Close()

	v := make(map[string]string)
	dec := gob.NewDecoder(x)
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}

func (f *FileStash) serialize(m map[string]string) error {
	x, err := os.Create(f.filename())
	if err != nil {
		return err
	}
	defer x.Close()
	enc := gob.NewEncoder(x)
	return enc.Encode(m)
}
