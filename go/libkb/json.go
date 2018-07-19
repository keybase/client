// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"

	jsonw "github.com/keybase/go-jsonw"
)

type jsonFileTransaction struct {
	f       *JSONFile
	tmpname string
}

var _ ConfigWriterTransacter = (*jsonFileTransaction)(nil)

type JSONFile struct {
	Contextified
	filename string
	which    string
	jw       *jsonw.Wrapper
	exists   bool

	txMutex sync.Mutex
	tx      *jsonFileTransaction
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
		}

		MobilePermissionDeniedCheck(f.G(), err, fmt.Sprintf("%s: %s", f.which, f.filename))

		if os.IsPermission(err) {
			f.G().Log.Warning("Permission denied opening %s file %s", f.which, f.filename)
			return nil
		}

		return err
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

	if runtime.GOOS == "android" {
		// marshal it into json without indents to make it one line
		out, err := json.Marshal(obj)
		if err != nil {
			f.G().Log.Debug("JSONFile.Load: error marshaling decoded config obj: %s", err)
		} else {
			f.G().Log.Debug("JSONFile.Load: %s contents (marshaled): %s", f.filename, string(out))
		}
	}

	f.G().Log.Debug("- successfully loaded %s file", f.which)
	return nil
}

func (f *JSONFile) Nuke() error {
	f.G().Log.Debug("+ nuke file %s", f.filename)
	err := os.Remove(f.filename)
	f.G().Log.Debug("- nuke file %s -> %s", f.filename, ErrToOk(err))
	return err
}

func (f *JSONFile) BeginTransaction() (ConfigWriterTransacter, error) {
	tx, err := newJSONFileTransaction(f)
	if err != nil {
		return nil, err
	}
	err = f.setTx(tx)
	if err != nil {
		return nil, err
	}
	return tx, nil
}

func (f *JSONFile) setTx(tx *jsonFileTransaction) error {
	f.txMutex.Lock()
	defer f.txMutex.Unlock()
	if f.tx != nil && tx != nil {
		return fmt.Errorf("Provision transaction already in progress")
	}
	f.tx = tx
	return nil
}

func (f *JSONFile) getOrMakeTx() (*jsonFileTransaction, bool, error) {
	f.txMutex.Lock()
	defer f.txMutex.Unlock()

	// if a transaction exists, use it
	if f.tx != nil {
		return f.tx, false, nil
	}

	// make a new transaction
	tx, err := newJSONFileTransaction(f)
	if err != nil {
		return nil, false, err
	}

	f.tx = tx

	// return true so caller knows that a transaction was created
	return f.tx, true, nil
}

func newJSONFileTransaction(f *JSONFile) (*jsonFileTransaction, error) {
	ret := &jsonFileTransaction{f: f}
	sffx, err := RandString("", 15)
	if err != nil {
		return nil, err
	}
	ret.tmpname = f.filename + "." + sffx
	return ret, nil
}

func (f *JSONFile) Save() error {
	tx, txCreated, err := f.getOrMakeTx()
	if err != nil {
		return err
	}
	if txCreated {
		// if Save() created a transaction, then abort it if it
		// still exists on exit
		defer func() {
			if tx != nil {
				tx.Abort()
			}
		}()
	}

	if err := f.save(); err != nil {
		return err
	}

	if txCreated {
		// this Save() call created a transaction, so commit it
		if err := tx.Commit(); err != nil {
			return err
		}

		// Commit worked, clear the transaction so defer() doesn't
		// abort it.
		tx = nil
	}

	return nil
}

func (f *JSONFile) save() (err error) {
	if f.tx == nil {
		return errors.New("save() called with nil transaction")
	}
	filename := f.tx.tmpname
	f.G().Log.Debug("+ saving %s file %s", f.which, filename)

	err = MakeParentDirs(f.G().Log, filename)
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
	writer, err = os.OpenFile(filename, flags, PermFile)
	if err != nil {
		f.G().Log.Errorf("Failed to open %s file %s for writing: %s",
			f.which, filename, err)
		return err
	}
	defer writer.Close()

	encoded, err := json.MarshalIndent(dat, "", "    ")
	if err != nil {
		f.G().Log.Errorf("Error marshaling data to %s file %s: %s", f.which, filename, err)
		return err
	}

	n, err := writer.Write(encoded)
	if err != nil {
		f.G().Log.Errorf("Error writing encoded data to %s file %s: %s", f.which, filename, err)
		return err
	}
	if n != len(encoded) {
		f.G().Log.Errorf("Error writing encoded data to %s file %s: wrote %d bytes, expected %d", f.which, filename, n, len(encoded))
		return io.ErrShortWrite
	}

	err = writer.Sync()
	if err != nil {
		f.G().Log.Errorf("Error syncing %s file %s: %s", f.which, filename, err)
		return err
	}

	err = writer.Close()
	if err != nil {
		f.G().Log.Errorf("Error closing %s file %s: %s", f.which, filename, err)
		return err
	}

	f.G().Log.Debug("- saved %s file %s", f.which, filename)

	if runtime.GOOS == "android" {
		f.G().Log.Debug("| Android extra checks in JSONFile.save")
		info, err := os.Stat(filename)
		if err != nil {
			f.G().Log.Errorf("| Error os.Stat(%s): %s", filename, err)
			return err
		}
		f.G().Log.Debug("| File info: name = %s", info.Name())
		f.G().Log.Debug("| File info: size = %d", info.Size())
		f.G().Log.Debug("| File info: mode = %s", info.Mode())
		f.G().Log.Debug("| File info: mod time = %s", info.ModTime())

		if info.Size() != int64(len(encoded)) {
			f.G().Log.Errorf("| File info size (%d) does not match encoded len (%d)", info.Size(), len(encoded))
			return fmt.Errorf("file info size (%d) does not match encoded len (%d)", info.Size(), len(encoded))
		}

		// write out the `dat` that was marshaled into filename
		encodedForLog, err := json.Marshal(dat)
		if err != nil {
			f.G().Log.Debug("error marshaling for log dump: %s", err)
		} else {
			f.G().Log.Debug("data written to %s:", filename)
			f.G().Log.Debug(string(encodedForLog))
		}

		// load the file and dump its contents to the log
		fc, err := os.Open(filename)
		if err != nil {
			f.G().Log.Debug("error opening %s to check its contents: %s", filename, err)
		} else {
			defer fc.Close()

			decoder := json.NewDecoder(fc)
			obj := make(map[string]interface{})
			if err := decoder.Decode(&obj); err != nil {
				f.G().Log.Debug("error decoding %s: %s", filename, err)
			} else {
				// marshal it into json without indents to make it one line
				out, err := json.Marshal(obj)
				if err != nil {
					f.G().Log.Debug("error marshaling decoded obj: %s", err)
				} else {
					f.G().Log.Debug("%s contents (marshaled): %s", filename, string(out))
				}
			}
		}

		f.G().Log.Debug("| Android extra checks done")
	}

	return nil
}

func (f *jsonFileTransaction) Abort() error {
	f.f.G().Log.Debug("+ Aborting %s rewrite %s", f.f.which, f.tmpname)
	err := os.Remove(f.tmpname)
	f.f.setTx(nil)
	f.f.G().Log.Debug("- Abort -> %s\n", ErrToOk(err))
	return err
}

func (f *jsonFileTransaction) Commit() (err error) {
	f.f.G().Log.Debug("+ Commit %s rewrite %s", f.f.which, f.tmpname)
	defer func() { f.f.G().Log.Debug("- Commit %s rewrite %s", f.f.which, ErrToOk(err)) }()

	f.f.G().Log.Debug("| Commit: making parent directories for %q", f.f.filename)
	if err = MakeParentDirs(f.f.G().Log, f.f.filename); err != nil {
		return err
	}
	f.f.G().Log.Debug("| Commit : renaming %q => %q", f.tmpname, f.f.filename)
	err = renameFile(f.f.G(), f.tmpname, f.f.filename)
	if err != nil {
		f.f.G().Log.Debug("| Commit: rename %q => %q error: %s", f.tmpname, f.f.filename, err)
	}
	f.f.setTx(nil)

	return err
}

type valueGetter func(*jsonw.Wrapper) (interface{}, error)

func (f JSONFile) getValueAtPath(p string, getter valueGetter) (ret interface{}, isSet bool) {
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		isSet = true
	}
	return
}

func getString(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetString()
}

func getBool(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetBool()
}

func getInt(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetInt()
}

func (f JSONFile) GetFilename() string {
	return f.filename
}

func (f JSONFile) GetInterfaceAtPath(p string) (i interface{}, err error) {
	return f.jw.AtPath(p).GetInterface()
}

func (f JSONFile) GetStringAtPath(p string) (ret string, isSet bool) {
	i, isSet := f.getValueAtPath(p, getString)
	if isSet {
		ret = i.(string)
	}
	return
}

func (f JSONFile) GetBoolAtPath(p string) (ret bool, isSet bool) {
	i, isSet := f.getValueAtPath(p, getBool)
	if isSet {
		ret = i.(bool)
	}
	return
}

func (f JSONFile) GetIntAtPath(p string) (ret int, isSet bool) {
	i, isSet := f.getValueAtPath(p, getInt)
	if isSet {
		ret = i.(int)
	}
	return
}

func (f JSONFile) GetNullAtPath(p string) (isSet bool) {
	w := f.jw.AtPath(p)
	isSet = w.IsNil() && w.Error() == nil
	return
}

func (f *JSONFile) setValueAtPath(p string, getter valueGetter, v interface{}) error {
	existing, err := getter(f.jw.AtPath(p))

	if err != nil || existing != v {
		err = f.jw.SetValueAtPath(p, jsonw.NewWrapper(v))
		if err == nil {
			return f.Save()
		}
	}
	return err
}

func (f *JSONFile) SetStringAtPath(p string, v string) error {
	return f.setValueAtPath(p, getString, v)
}

func (f *JSONFile) SetBoolAtPath(p string, v bool) error {
	return f.setValueAtPath(p, getBool, v)
}

func (f *JSONFile) SetIntAtPath(p string, v int) error {
	return f.setValueAtPath(p, getInt, v)
}

func (f *JSONFile) SetInt64AtPath(p string, v int64) error {
	return f.setValueAtPath(p, getInt, v)
}

func (f *JSONFile) SetNullAtPath(p string) (err error) {
	existing := f.jw.AtPath(p)
	if !existing.IsNil() || existing.Error() != nil {
		err = f.jw.SetValueAtPath(p, jsonw.NewNil())
		if err == nil {
			return f.Save()
		}
	}
	return
}
