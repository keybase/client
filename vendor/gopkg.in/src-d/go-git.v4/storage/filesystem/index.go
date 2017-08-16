package filesystem

import (
	"os"

	"gopkg.in/src-d/go-git.v4/plumbing/format/index"
	"gopkg.in/src-d/go-git.v4/storage/filesystem/internal/dotgit"
)

type IndexStorage struct {
	dir *dotgit.DotGit
}

func (s *IndexStorage) SetIndex(idx *index.Index) error {
	f, err := s.dir.IndexWriter()
	if err != nil {
		return err
	}

	defer f.Close()

	e := index.NewEncoder(f)
	return e.Encode(idx)
}

func (s *IndexStorage) Index() (*index.Index, error) {
	idx := &index.Index{
		Version: 2,
	}

	f, err := s.dir.Index()
	if err != nil {
		if os.IsNotExist(err) {
			return idx, nil
		}

		return nil, err
	}

	defer f.Close()

	d := index.NewDecoder(f)
	return idx, d.Decode(idx)
}
