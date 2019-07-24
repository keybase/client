// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
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
	setMutex sync.RWMutex

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
	found, err := f.LoadCheckFound()
	if err != nil {
		return err
	}
	if !found {
		msg := fmt.Sprintf("No %q file found; tried %s", f.which, f.filename)
		if warnOnNotFound {
			f.G().Log.Warning(msg)
		} else {
			f.G().Log.Debug(msg)
		}
	}
	return nil
}

func (f *JSONFile) LoadCheckFound() (found bool, err error) {
	f.G().Log.Debug("+ loading %q file: %s", f.which, f.filename)
	file, err := os.Open(f.filename)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}

		MobilePermissionDeniedCheck(f.G(), err, fmt.Sprintf("%s: %s", f.which, f.filename))

		if os.IsPermission(err) {
			f.G().Log.Warning("Permission denied opening %s file %s", f.which, f.filename)
			return true, nil
		}

		return true, err
	}
	f.exists = true
	defer file.Close()

	var buf bytes.Buffer
	fileTee := io.TeeReader(bufio.NewReader(file), &buf)
	err = jsonw.EnsureMaxDepthDefault(bufio.NewReader(fileTee))
	if err != nil {
		return true, err
	}

	decoder := json.NewDecoder(&buf)
	obj := make(map[string]interface{})
	// Treat empty files like an empty dictionary
	if err = decoder.Decode(&obj); err != nil && err != io.EOF {
		f.G().Log.Errorf("Error decoding %s file %s", f.which, f.filename)
		return true, err
	}
	f.jw = jsonw.NewWrapper(obj)

	f.G().Log.Debug("- successfully loaded %s file", f.which)
	return true, nil
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
	if err = f.setTx(tx); err != nil {
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

func (f *JSONFile) SetWrapperAtPath(p string, w *jsonw.Wrapper) error {
	err := f.jw.SetValueAtPath(p, w)
	if err == nil {
		err = f.Save()
	}
	return err
}

func (f *JSONFile) DeleteAtPath(p string) {
	f.jw.DeleteValueAtPath(p)
	f.Save()
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

// Rollback reloads config from unchanged config file, bringing its
// state back to from before the transaction changes. Note that it
// only works for changes that do not affect UserConfig, which caches
// values, and has to be reloaded manually.
func (f *jsonFileTransaction) Rollback() error {
	f.f.G().Log.Debug("+ Rolling back %s to state from %s", f.f.which, f.f.filename)
	err := f.f.Load(false)
	if !f.f.exists {
		// Before transaction there was no file, so set in-memory
		// wrapper to clean state as well.
		f.f.jw = jsonw.NewDictionary()
		f.f.G().Log.Debug("+ Rolling back to clean state because f.exists is false")
	}
	f.f.G().Log.Debug("- Rollback -> %s", ErrToOk(err))
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

func (f *JSONFile) getValueAtPath(p string, getter valueGetter) (ret interface{}, isSet bool) {
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		isSet = true
	}
	return ret, isSet
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

func (f *JSONFile) GetFilename() string {
	return f.filename
}

func (f *JSONFile) GetInterfaceAtPath(p string) (i interface{}, err error) {
	f.setMutex.RLock()
	defer f.setMutex.RUnlock()
	return f.jw.AtPath(p).GetInterface()
}

func (f *JSONFile) GetStringAtPath(p string) (ret string, isSet bool) {
	f.setMutex.RLock()
	defer f.setMutex.RUnlock()
	i, isSet := f.getValueAtPath(p, getString)
	if isSet {
		ret = i.(string)
	}
	return ret, isSet
}

func (f *JSONFile) GetBoolAtPath(p string) (ret bool, isSet bool) {
	f.setMutex.RLock()
	defer f.setMutex.RUnlock()
	i, isSet := f.getValueAtPath(p, getBool)
	if isSet {
		ret = i.(bool)
	}
	return ret, isSet
}

func (f *JSONFile) GetIntAtPath(p string) (ret int, isSet bool) {
	f.setMutex.RLock()
	defer f.setMutex.RUnlock()
	i, isSet := f.getValueAtPath(p, getInt)
	if isSet {
		ret = i.(int)
	}
	return ret, isSet
}

func (f *JSONFile) GetNullAtPath(p string) (isSet bool) {
	f.setMutex.RLock()
	defer f.setMutex.RUnlock()
	w := f.jw.AtPath(p)
	isSet = w.IsNil() && w.Error() == nil
	return isSet
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
	f.setMutex.Lock()
	defer f.setMutex.Unlock()
	return f.setValueAtPath(p, getString, v)
}

func (f *JSONFile) SetBoolAtPath(p string, v bool) error {
	f.setMutex.Lock()
	defer f.setMutex.Unlock()
	return f.setValueAtPath(p, getBool, v)
}

func (f *JSONFile) SetIntAtPath(p string, v int) error {
	f.setMutex.Lock()
	defer f.setMutex.Unlock()
	return f.setValueAtPath(p, getInt, v)
}

func (f *JSONFile) SetInt64AtPath(p string, v int64) error {
	f.setMutex.Lock()
	defer f.setMutex.Unlock()
	return f.setValueAtPath(p, getInt, v)
}

func (f *JSONFile) SetNullAtPath(p string) (err error) {
	f.setMutex.Lock()
	defer f.setMutex.Unlock()
	existing := f.jw.AtPath(p)
	if !existing.IsNil() || existing.Error() != nil {
		err = f.jw.SetValueAtPath(p, jsonw.NewNil())
		if err == nil {
			return f.Save()
		}
	}
	return err
}

func isJSONNoSuchKeyError(err error) bool {
	_, isJSONError := err.(*jsonw.Error)
	return err != nil && isJSONError && strings.Contains(err.Error(), "no such key")
}
