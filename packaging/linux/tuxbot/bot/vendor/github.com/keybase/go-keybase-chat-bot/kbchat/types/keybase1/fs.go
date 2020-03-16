// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/fs.avdl

package keybase1

type File struct {
	Path string `codec:"path" json:"path"`
}

func (o File) DeepCopy() File {
	return File{
		Path: o.Path,
	}
}

type ListResult struct {
	Files []File `codec:"files" json:"files"`
}

func (o ListResult) DeepCopy() ListResult {
	return ListResult{
		Files: (func(x []File) []File {
			if x == nil {
				return nil
			}
			ret := make([]File, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Files),
	}
}
