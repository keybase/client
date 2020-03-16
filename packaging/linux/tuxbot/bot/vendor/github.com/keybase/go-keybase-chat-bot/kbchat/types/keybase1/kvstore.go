// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/kvstore.avdl

package keybase1

type KVGetResult struct {
	TeamName   string `codec:"teamName" json:"teamName"`
	Namespace  string `codec:"namespace" json:"namespace"`
	EntryKey   string `codec:"entryKey" json:"entryKey"`
	EntryValue string `codec:"entryValue" json:"entryValue"`
	Revision   int    `codec:"revision" json:"revision"`
}

func (o KVGetResult) DeepCopy() KVGetResult {
	return KVGetResult{
		TeamName:   o.TeamName,
		Namespace:  o.Namespace,
		EntryKey:   o.EntryKey,
		EntryValue: o.EntryValue,
		Revision:   o.Revision,
	}
}

type KVPutResult struct {
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
	Revision  int    `codec:"revision" json:"revision"`
}

func (o KVPutResult) DeepCopy() KVPutResult {
	return KVPutResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
		Revision:  o.Revision,
	}
}

type KVEntryID struct {
	TeamID    TeamID `codec:"teamID" json:"teamID"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
}

func (o KVEntryID) DeepCopy() KVEntryID {
	return KVEntryID{
		TeamID:    o.TeamID.DeepCopy(),
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
	}
}

type EncryptedKVEntry struct {
	V int    `codec:"v" json:"v"`
	E []byte `codec:"e" json:"e"`
	N []byte `codec:"n" json:"n"`
}

func (o EncryptedKVEntry) DeepCopy() EncryptedKVEntry {
	return EncryptedKVEntry{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.N),
	}
}

type KVListNamespaceResult struct {
	TeamName   string   `codec:"teamName" json:"teamName"`
	Namespaces []string `codec:"namespaces" json:"namespaces"`
}

func (o KVListNamespaceResult) DeepCopy() KVListNamespaceResult {
	return KVListNamespaceResult{
		TeamName: o.TeamName,
		Namespaces: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Namespaces),
	}
}

type KVListEntryKey struct {
	EntryKey string `codec:"entryKey" json:"entryKey"`
	Revision int    `codec:"revision" json:"revision"`
}

func (o KVListEntryKey) DeepCopy() KVListEntryKey {
	return KVListEntryKey{
		EntryKey: o.EntryKey,
		Revision: o.Revision,
	}
}

type KVListEntryResult struct {
	TeamName  string           `codec:"teamName" json:"teamName"`
	Namespace string           `codec:"namespace" json:"namespace"`
	EntryKeys []KVListEntryKey `codec:"entryKeys" json:"entryKeys"`
}

func (o KVListEntryResult) DeepCopy() KVListEntryResult {
	return KVListEntryResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKeys: (func(x []KVListEntryKey) []KVListEntryKey {
			if x == nil {
				return nil
			}
			ret := make([]KVListEntryKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.EntryKeys),
	}
}

type KVDeleteEntryResult struct {
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
	Revision  int    `codec:"revision" json:"revision"`
}

func (o KVDeleteEntryResult) DeepCopy() KVDeleteEntryResult {
	return KVDeleteEntryResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
		Revision:  o.Revision,
	}
}
