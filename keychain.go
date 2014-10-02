
package libkb

import (
	"os"
	"fmt"
	"code.google.com/p/go.crypto/openpgp"
)

type KeychainFile struct {
	filename string
	Entities openpgp.EntityList
}

type Keychains struct {
	Public []KeychainFile
	Secret []KeychainFile
}

func (k Keychains) MakeKeychains(out *[]KeychainFile, filenames []string) {
	*out = make([]KeychainFile, len(filenames))
	for i,filename := range(filenames) {
		(*out)[i] = KeychainFile { filename, openpgp.EntityList{} }
	}
}

func NewKeychains(e Env) *Keychains {
	ret := &Keychains{}
	ret.MakeKeychains(&ret.Public, e.GetPublicKeychains())
	ret.MakeKeychains(&ret.Secret, e.GetSecretKeychains())
	return ret
}

func (k *Keychains) Load() (err error) {
	G.Log.Debug("+ Loading keychains")
	err = k.LoadKeychains(k.Public)
	if err == nil { k.LoadKeychains(k.Secret) }
	G.Log.Debug("- Loaded keychains")
	return err
}

func (k Keychains) LoadKeychains(v []KeychainFile) (err error) {
	for _,k := range(v) {
		if err = k.Load(); err != nil {
			return err
		}
	}
	return nil
}

func (k *KeychainFile) Load() error {
	G.Log.Debug(fmt.Sprintf("+ Loading PGP Keychain %s", k.filename))
	file, err := os.Open(k.filename)
	if os.IsNotExist(err) {
		G.Log.Warning(fmt.Sprintf("No PGP Keychain found at %s", k.filename))
		err = nil
	} else if err != nil {
		G.Log.Error(fmt.Sprintf("Cannot open keyring %s: %s\n", err.Error()))
		return err
	}
	if file != nil {
		k.Entities, err = openpgp.ReadKeyRing(file)
		if err != nil {
			G.Log.Error(fmt.Sprintf("Cannot parse keyring %s: %s\n", err.Error()))
			return err
		}
	}
	G.Log.Debug(fmt.Sprintf("- Successfully loaded PGP Keychain"))
	return nil
}

func (k KeychainFile) writeTo(file *os.File) error {
	for _, e := range(k.Entities) {
		if err := e.Serialize(file); err != nil {
			return err
		}
	}
	return nil
}

func (k KeychainFile) Save() error {
	G.Log.Debug(fmt.Sprintf("+ Writing to PGP keychain %s", k.filename))
	tmpfn, tmp, err := TempFile(k.filename, 0600)
	G.Log.Debug(fmt.Sprintf("| Temporary file generated: %s", tmpfn))
	if err != nil { return err }

	err = k.writeTo(tmp)
	if err == nil {
		err = tmp.Close()
		if err != nil {
			err = os.Rename(tmpfn, k.filename)
		} else {
			G.Log.Error(fmt.Sprintf("Error closing temporary file %s: %s", tmp, err.Error()))
			os.Remove(tmpfn)
		}
	} else {
		G.Log.Error(fmt.Sprintf("Error writing temporary keyring %s: %s", tmp, err.Error()))
		tmp.Close()
		os.Remove(tmpfn)
	}
	G.Log.Debug(fmt.Sprintf("- Wrote to PGP keychain %s -> %s", k.filename, ErrToOk(err)))
	return err
}

