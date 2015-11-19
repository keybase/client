// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"

	jsonw "github.com/keybase/go-jsonw"
)

type JSONFile struct {
	filename string
	which    string
	jw       *jsonw.Wrapper
	exists   bool
	dirty    bool
	Contextified
}

func NewJSONFile(g *GlobalContext, filename, which string) *JSONFile {
	return &JSONFile{
		filename:     filename,
		which:        which,
		jw:           jsonw.NewDictionary(),
		Contextified: NewContextified(g),
	}
}

func (f *JSONFile) GetWrapper() *jsonw.Wrapper {
	return f.jw
}
func (f *JSONFile) Exists() bool { return f.exists }

func (f *JSONFile) Load(warnOnNotFound bool) error {
	f.G().Log.Debug("+ loading %s file: %s", f.which, f.filename)
	file, err := os.Open(f.filename)
	if err != nil {
		if os.IsNotExist(err) {
			msg := fmt.Sprintf("No %s file found; tried %s", f.which, f.filename)
			if warnOnNotFound {
				f.G().Log.Warning(msg)
			} else {
				f.G().Log.Debug(msg)
			}
			return nil
		} else if os.IsPermission(err) {
			f.G().Log.Warning("Permission denied opening %s file %s", f.which, f.filename)
			return nil
		} else {
			return err
		}
	}
	f.exists = true
	defer file.Close()
	decoder := json.NewDecoder(file)
	obj := make(map[string]interface{})
	// Treat empty files like an empty dictionary
	if err = decoder.Decode(&obj); err != nil && err != io.EOF {
		f.G().Log.Errorf("Error decoding %s file %s", f.which, f.filename)
		return err
	}
	f.jw = jsonw.NewWrapper(obj)
	f.G().Log.Debug("- successfully loaded %s file", f.which)
	return nil
}

func (f *JSONFile) MaybeSave(pretty bool, mode os.FileMode) (err error) {
	if f != nil && f.dirty {
		err = f.Save(pretty, mode)
	}
	return
}

func (f *JSONFile) Nuke() error {
	f.G().Log.Debug("+ nuke file %s", f.filename)

	err := os.Remove(f.filename)
	f.G().Log.Debug("- nuke file %s -> %s", f.filename, ErrToOk(err))

	return err
}

func (f *JSONFile) Save(pretty bool, mode os.FileMode) error {
	if err := f.save(f.filename, pretty, mode); err != nil {
		return err
	}
	f.dirty = false
	return nil
}

// SaveTmp saves the config to a temporary file.  It returns the
// filename and any error.
func (f *JSONFile) SaveTmp(suffix string) (string, error) {
	filename := path.Join(path.Dir(f.filename), fmt.Sprintf("keybase_config_%s.json", suffix))
	if err := f.save(filename, true, 0); err != nil {
		return "", err
	}
	return filename, nil
}

func (f *JSONFile) save(filename string, pretty bool, mode os.FileMode) (err error) {
	f.G().Log.Debug("+ saving %s file %s", f.which, filename)

	err = MakeParentDirs(filename)
	if err != nil {
		f.G().Log.Errorf("Failed to make parent dirs for %s", filename)
		return err
	}

	var dat interface{}

	if f.jw == nil {
		// Make a default Dictionary if none already exists
		dat = make(map[string]interface{})
		f.G().Log.Warning("No value for %s file; assuming empty value (i.e., {})",
			f.which)
	} else {
		dat, err = f.jw.GetData()
		if err != nil {
			f.G().Log.Errorf("Failed to encode data for %s file", f.which)
			return err
		}
	}
	var writer *os.File
	flags := (os.O_WRONLY | os.O_CREATE | os.O_TRUNC)
	if mode == 0 {
		mode = PermFile // By default, secrecy
	}
	writer, err = os.OpenFile(filename, flags, mode)
	if err != nil {
		f.G().Log.Errorf("Failed to open %s file %s for writing: %s",
			f.which, filename, err)
		return err
	}
	defer writer.Close()

	if pretty {
		encoded, err := json.MarshalIndent(dat, "", "    ")
		if err == nil {
			_, err = writer.Write(encoded)
		}
	} else {
		encoder := json.NewEncoder(writer)
		err = encoder.Encode(dat)
	}

	if err != nil {
		f.G().Log.Errorf("Error encoding data to %s file %s: %s",
			f.which, filename, err)
		return err
	}

	err = writer.Close()
	if err != nil {
		f.G().Log.Errorf("Error flushing %s file %s: %s", f.which, filename, err)
		return err
	}

	f.G().Log.Debug("Wrote %s file to %s", f.which, filename)

	f.G().Log.Debug("- saved %s file %s", f.which, filename)
	return
}

func (f *JSONFile) SwapTmp(filename string) error {
	if err := MakeParentDirs(f.filename); err != nil {
		return err
	}
	return os.Rename(filename, f.filename)
}
