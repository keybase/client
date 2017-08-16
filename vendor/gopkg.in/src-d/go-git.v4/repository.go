package git

import (
	"errors"
	"fmt"
	stdioutil "io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/internal/revision"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
	"gopkg.in/src-d/go-git.v4/storage/filesystem"
	"gopkg.in/src-d/go-git.v4/utils/ioutil"

	"gopkg.in/src-d/go-billy.v3"
	"gopkg.in/src-d/go-billy.v3/osfs"
)

var (
	ErrInvalidReference        = errors.New("invalid reference, should be a tag or a branch")
	ErrRepositoryNotExists     = errors.New("repository not exists")
	ErrRepositoryAlreadyExists = errors.New("repository already exists")
	ErrRemoteNotFound          = errors.New("remote not found")
	ErrRemoteExists            = errors.New("remote already exists")
	ErrWorktreeNotProvided     = errors.New("worktree should be provided")
	ErrIsBareRepository        = errors.New("worktree not available in a bare repository")
)

// Repository represents a git repository
type Repository struct {
	Storer storage.Storer

	r  map[string]*Remote
	wt billy.Filesystem
}

// Init creates an empty git repository, based on the given Storer and worktree.
// The worktree Filesystem is optional, if nil a bare repository is created. If
// the given storer is not empty ErrRepositoryAlreadyExists is returned
func Init(s storage.Storer, worktree billy.Filesystem) (*Repository, error) {
	if err := initStorer(s); err != nil {
		return nil, err
	}

	r := newRepository(s, worktree)
	_, err := r.Reference(plumbing.HEAD, false)
	switch err {
	case plumbing.ErrReferenceNotFound:
	case nil:
		return nil, ErrRepositoryAlreadyExists
	default:
		return nil, err
	}

	h := plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.Master)
	if err := s.SetReference(h); err != nil {
		return nil, err
	}

	if worktree == nil {
		r.setIsBare(true)
		return r, nil
	}

	return r, setWorktreeAndStoragePaths(r, worktree)
}

func initStorer(s storer.Storer) error {
	i, ok := s.(storer.Initializer)
	if !ok {
		return nil
	}

	return i.Init()
}

func setWorktreeAndStoragePaths(r *Repository, worktree billy.Filesystem) error {
	type fsBased interface {
		Filesystem() billy.Filesystem
	}

	// .git file is only created if the storage is file based and the file
	// system is osfs.OS
	fs, isFSBased := r.Storer.(fsBased)
	if !isFSBased {
		return nil
	}

	if err := createDotGitFile(worktree, fs.Filesystem()); err != nil {
		return err
	}

	return setConfigWorktree(r, worktree, fs.Filesystem())
}

func createDotGitFile(worktree, storage billy.Filesystem) error {
	path, err := filepath.Rel(worktree.Root(), storage.Root())
	if err != nil {
		path = storage.Root()
	}

	if path == ".git" {
		// not needed, since the folder is the default place
		return nil
	}

	f, err := worktree.Create(".git")
	if err != nil {
		return err
	}

	defer f.Close()
	_, err = fmt.Fprintf(f, "gitdir: %s\n", path)
	return err
}

func setConfigWorktree(r *Repository, worktree, storage billy.Filesystem) error {
	path, err := filepath.Rel(storage.Root(), worktree.Root())
	if err != nil {
		path = worktree.Root()
	}

	if path == ".." {
		// not needed, since the folder is the default place
		return nil
	}

	cfg, err := r.Storer.Config()
	if err != nil {
		return err
	}

	cfg.Core.Worktree = path
	return r.Storer.SetConfig(cfg)
}

// Open opens a git repository using the given Storer and worktree filesystem,
// if the given storer is complete empty ErrRepositoryNotExists is returned.
// The worktree can be nil when the repository being opened is bare, if the
// repository is a normal one (not bare) and worktree is nil the err
// ErrWorktreeNotProvided is returned
func Open(s storage.Storer, worktree billy.Filesystem) (*Repository, error) {
	_, err := s.Reference(plumbing.HEAD)
	if err == plumbing.ErrReferenceNotFound {
		return nil, ErrRepositoryNotExists
	}

	if err != nil {
		return nil, err
	}

	cfg, err := s.Config()
	if err != nil {
		return nil, err
	}

	if !cfg.Core.IsBare && worktree == nil {
		return nil, ErrWorktreeNotProvided
	}

	return newRepository(s, worktree), nil
}

// Clone a repository into the given Storer and worktree Filesystem with the
// given options, if worktree is nil a bare repository is created. If the given
// storer is not empty ErrRepositoryAlreadyExists is returned
func Clone(s storage.Storer, worktree billy.Filesystem, o *CloneOptions) (*Repository, error) {
	r, err := Init(s, worktree)
	if err != nil {
		return nil, err
	}

	return r, r.clone(o)
}

// PlainInit create an empty git repository at the given path. isBare defines
// if the repository will have worktree (non-bare) or not (bare), if the path
// is not empty ErrRepositoryAlreadyExists is returned
func PlainInit(path string, isBare bool) (*Repository, error) {
	var wt, dot billy.Filesystem

	if isBare {
		dot = osfs.New(path)
	} else {
		wt = osfs.New(path)
		dot, _ = wt.Chroot(".git")
	}

	s, err := filesystem.NewStorage(dot)
	if err != nil {
		return nil, err
	}

	return Init(s, wt)
}

// PlainOpen opens a git repository from the given path. It detects if the
// repository is bare or a normal one. If the path doesn't contain a valid
// repository ErrRepositoryNotExists is returned
func PlainOpen(path string) (*Repository, error) {
	dot, wt, err := dotGitToOSFilesystems(path)
	if err != nil {
		return nil, err
	}

	if _, err := dot.Stat(""); err != nil {
		if os.IsNotExist(err) {
			return nil, ErrRepositoryNotExists
		}

		return nil, err
	}

	s, err := filesystem.NewStorage(dot)
	if err != nil {
		return nil, err
	}

	return Open(s, wt)
}

func dotGitToOSFilesystems(path string) (dot, wt billy.Filesystem, err error) {
	fs := osfs.New(path)
	fi, err := fs.Stat(".git")
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, nil, err
		}

		return fs, nil, nil
	}

	if fi.IsDir() {
		dot, err = fs.Chroot(".git")
		return dot, fs, err
	}

	dot, err = dotGitFileToOSFilesystem(path, fs)
	if err != nil {
		return nil, nil, err
	}

	return dot, fs, nil
}

func dotGitFileToOSFilesystem(path string, fs billy.Filesystem) (billy.Filesystem, error) {
	var err error

	f, err := fs.Open(".git")
	if err != nil {
		return nil, err
	}
	defer ioutil.CheckClose(f, &err)

	b, err := stdioutil.ReadAll(f)
	if err != nil {
		return nil, err
	}

	line := string(b)
	const prefix = "gitdir: "
	if !strings.HasPrefix(line, prefix) {
		return nil, fmt.Errorf(".git file has no %s prefix", prefix)
	}

	gitdir := line[len(prefix):]
	gitdir = strings.TrimSpace(gitdir)
	if filepath.IsAbs(gitdir) {
		return osfs.New(gitdir), nil
	}

	return osfs.New(fs.Join(path, gitdir)), nil
}

// PlainClone a repository into the path with the given options, isBare defines
// if the new repository will be bare or normal. If the path is not empty
// ErrRepositoryAlreadyExists is returned
func PlainClone(path string, isBare bool, o *CloneOptions) (*Repository, error) {
	r, err := PlainInit(path, isBare)
	if err != nil {
		return nil, err
	}

	return r, r.clone(o)
}

func newRepository(s storage.Storer, worktree billy.Filesystem) *Repository {
	return &Repository{
		Storer: s,
		wt:     worktree,
		r:      make(map[string]*Remote, 0),
	}
}

// Config return the repository config
func (r *Repository) Config() (*config.Config, error) {
	return r.Storer.Config()
}

// Remote return a remote if exists
func (r *Repository) Remote(name string) (*Remote, error) {
	cfg, err := r.Storer.Config()
	if err != nil {
		return nil, err
	}

	c, ok := cfg.Remotes[name]
	if !ok {
		return nil, ErrRemoteNotFound
	}

	return newRemote(r.Storer, c), nil
}

// Remotes returns a list with all the remotes
func (r *Repository) Remotes() ([]*Remote, error) {
	cfg, err := r.Storer.Config()
	if err != nil {
		return nil, err
	}

	remotes := make([]*Remote, len(cfg.Remotes))

	var i int
	for _, c := range cfg.Remotes {
		remotes[i] = newRemote(r.Storer, c)
		i++
	}

	return remotes, nil
}

// CreateRemote creates a new remote
func (r *Repository) CreateRemote(c *config.RemoteConfig) (*Remote, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}

	remote := newRemote(r.Storer, c)

	cfg, err := r.Storer.Config()
	if err != nil {
		return nil, err
	}

	if _, ok := cfg.Remotes[c.Name]; ok {
		return nil, ErrRemoteExists
	}

	cfg.Remotes[c.Name] = c
	return remote, r.Storer.SetConfig(cfg)
}

// DeleteRemote delete a remote from the repository and delete the config
func (r *Repository) DeleteRemote(name string) error {
	cfg, err := r.Storer.Config()
	if err != nil {
		return err
	}

	if _, ok := cfg.Remotes[name]; !ok {
		return ErrRemoteNotFound
	}

	delete(cfg.Remotes, name)
	return r.Storer.SetConfig(cfg)
}

// Clone clones a remote repository
func (r *Repository) clone(o *CloneOptions) error {
	if err := o.Validate(); err != nil {
		return err
	}

	c := &config.RemoteConfig{
		Name: o.RemoteName,
		URL:  o.URL,
	}

	remote, err := r.CreateRemote(c)
	if err != nil {
		return err
	}

	remoteRefs, err := remote.fetch(&FetchOptions{
		RefSpecs: r.cloneRefSpec(o, c),
		Depth:    o.Depth,
		Auth:     o.Auth,
		Progress: o.Progress,
	})
	if err != nil {
		return err
	}

	head, err := storer.ResolveReference(remoteRefs, o.ReferenceName)
	if err != nil {
		return err
	}

	if _, err := r.updateReferences(c.Fetch, head); err != nil {
		return err
	}

	if err := r.updateWorktree(head.Name()); err != nil {
		return err
	}

	if o.RecurseSubmodules != NoRecurseSubmodules && r.wt != nil {
		if err := r.updateSubmodules(o.RecurseSubmodules); err != nil {
			return err
		}
	}

	return r.updateRemoteConfig(remote, o, c, head)
}

func (r *Repository) updateSubmodules(recursion SubmoduleRescursivity) error {
	w, err := r.Worktree()
	if err != nil {
		return err
	}

	s, err := w.Submodules()
	if err != nil {
		return err
	}

	return s.Update(&SubmoduleUpdateOptions{
		Init:              true,
		RecurseSubmodules: recursion,
	})
}

func (r *Repository) cloneRefSpec(o *CloneOptions,
	c *config.RemoteConfig) []config.RefSpec {

	if !o.SingleBranch {
		return c.Fetch
	}

	var rs string

	if o.ReferenceName == plumbing.HEAD {
		rs = fmt.Sprintf(refspecSingleBranchHEAD, c.Name)
	} else {
		rs = fmt.Sprintf(refspecSingleBranch,
			o.ReferenceName.Short(), c.Name)
	}

	return []config.RefSpec{config.RefSpec(rs)}
}

func (r *Repository) setIsBare(isBare bool) error {
	cfg, err := r.Storer.Config()
	if err != nil {
		return err
	}

	cfg.Core.IsBare = isBare
	return r.Storer.SetConfig(cfg)
}

const (
	refspecSingleBranch     = "+refs/heads/%s:refs/remotes/%s/%[1]s"
	refspecSingleBranchHEAD = "+HEAD:refs/remotes/%s/HEAD"
)

func (r *Repository) updateRemoteConfig(remote *Remote, o *CloneOptions,
	c *config.RemoteConfig, head *plumbing.Reference) error {

	if !o.SingleBranch {
		return nil
	}

	c.Fetch = []config.RefSpec{config.RefSpec(fmt.Sprintf(
		refspecSingleBranch, head.Name().Short(), c.Name,
	))}

	cfg, err := r.Storer.Config()
	if err != nil {
		return err
	}

	cfg.Remotes[c.Name] = c
	return r.Storer.SetConfig(cfg)
}

func (r *Repository) updateReferences(spec []config.RefSpec,
	resolvedHead *plumbing.Reference) (updated bool, err error) {

	if !resolvedHead.IsBranch() {
		// Detached HEAD mode
		head := plumbing.NewHashReference(plumbing.HEAD, resolvedHead.Hash())
		return updateReferenceStorerIfNeeded(r.Storer, head)
	}

	refs := []*plumbing.Reference{
		// Create local reference for the resolved head
		resolvedHead,
		// Create local symbolic HEAD
		plumbing.NewSymbolicReference(plumbing.HEAD, resolvedHead.Name()),
	}

	refs = append(refs, r.calculateRemoteHeadReference(spec, resolvedHead)...)

	for _, ref := range refs {
		u, err := updateReferenceStorerIfNeeded(r.Storer, ref)
		if err != nil {
			return updated, err
		}

		if u {
			updated = true
		}
	}

	return
}

func (r *Repository) calculateRemoteHeadReference(spec []config.RefSpec,
	resolvedHead *plumbing.Reference) []*plumbing.Reference {

	var refs []*plumbing.Reference

	// Create resolved HEAD reference with remote prefix if it does not
	// exist. This is needed when using single branch and HEAD.
	for _, rs := range spec {
		name := resolvedHead.Name()
		if !rs.Match(name) {
			continue
		}

		name = rs.Dst(name)
		_, err := r.Storer.Reference(name)
		if err == plumbing.ErrReferenceNotFound {
			refs = append(refs, plumbing.NewHashReference(name, resolvedHead.Hash()))
		}
	}

	return refs
}

func updateReferenceStorerIfNeeded(
	s storer.ReferenceStorer, r *plumbing.Reference) (updated bool, err error) {

	p, err := s.Reference(r.Name())
	if err != nil && err != plumbing.ErrReferenceNotFound {
		return false, err
	}

	// we use the string method to compare references, is the easiest way
	if err == plumbing.ErrReferenceNotFound || r.String() != p.String() {
		if err := s.SetReference(r); err != nil {
			return false, err
		}

		return true, nil
	}

	return false, nil
}

// Pull incorporates changes from a remote repository into the current branch.
// Returns nil if the operation is successful, NoErrAlreadyUpToDate if there are
// no changes to be fetched, or an error.
func (r *Repository) Pull(o *PullOptions) error {
	if err := o.Validate(); err != nil {
		return err
	}

	remote, err := r.Remote(o.RemoteName)
	if err != nil {
		return err
	}

	remoteRefs, err := remote.fetch(&FetchOptions{
		Depth:    o.Depth,
		Auth:     o.Auth,
		Progress: o.Progress,
	})

	updated := true
	if err == NoErrAlreadyUpToDate {
		updated = false
	} else if err != nil {
		return err
	}

	head, err := storer.ResolveReference(remoteRefs, o.ReferenceName)
	if err != nil {
		return err
	}

	refsUpdated, err := r.updateReferences(remote.c.Fetch, head)
	if err != nil {
		return err
	}

	if refsUpdated {
		updated = refsUpdated
	}

	if !updated {
		return NoErrAlreadyUpToDate
	}

	if err := r.updateWorktree(head.Name()); err != nil {
		return err
	}

	if o.RecurseSubmodules != NoRecurseSubmodules && r.wt != nil {
		if err := r.updateSubmodules(o.RecurseSubmodules); err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) updateWorktree(branch plumbing.ReferenceName) error {
	if r.wt == nil {
		return nil
	}

	b, err := r.Reference(branch, true)
	if err != nil {
		return err
	}

	w, err := r.Worktree()
	if err != nil {
		return err
	}

	return w.Reset(&ResetOptions{
		Commit: b.Hash(),
	})
}

// Fetch fetches changes from a remote repository.
// Returns nil if the operation is successful, NoErrAlreadyUpToDate if there are
// no changes to be fetched, or an error.
func (r *Repository) Fetch(o *FetchOptions) error {
	if err := o.Validate(); err != nil {
		return err
	}

	remote, err := r.Remote(o.RemoteName)
	if err != nil {
		return err
	}

	return remote.Fetch(o)
}

// Push pushes changes to a remote.
func (r *Repository) Push(o *PushOptions) error {
	if err := o.Validate(); err != nil {
		return err
	}

	remote, err := r.Remote(o.RemoteName)
	if err != nil {
		return err
	}

	return remote.Push(o)
}

// Log returns the commit history from the given LogOptions.
func (r *Repository) Log(o *LogOptions) (object.CommitIter, error) {
	h := o.From
	if o.From == plumbing.ZeroHash {
		head, err := r.Head()
		if err != nil {
			return nil, err
		}

		h = head.Hash()
	}

	commit, err := r.CommitObject(h)
	if err != nil {
		return nil, err
	}

	return object.NewCommitPreorderIter(commit), nil
}

// Tags returns all the References from Tags. This method returns all the tag
// types, lightweight, and annotated ones.
func (r *Repository) Tags() (storer.ReferenceIter, error) {
	refIter, err := r.Storer.IterReferences()
	if err != nil {
		return nil, err
	}

	return storer.NewReferenceFilteredIter(
		func(r *plumbing.Reference) bool {
			return r.IsTag()
		}, refIter), nil
}

// Branches returns all the References that are Branches.
func (r *Repository) Branches() (storer.ReferenceIter, error) {
	refIter, err := r.Storer.IterReferences()
	if err != nil {
		return nil, err
	}

	return storer.NewReferenceFilteredIter(
		func(r *plumbing.Reference) bool {
			return r.IsBranch()
		}, refIter), nil
}

// Notes returns all the References that are Branches.
func (r *Repository) Notes() (storer.ReferenceIter, error) {
	refIter, err := r.Storer.IterReferences()
	if err != nil {
		return nil, err
	}

	return storer.NewReferenceFilteredIter(
		func(r *plumbing.Reference) bool {
			return r.IsNote()
		}, refIter), nil
}

// TreeObject return a Tree with the given hash. If not found
// plumbing.ErrObjectNotFound is returned
func (r *Repository) TreeObject(h plumbing.Hash) (*object.Tree, error) {
	return object.GetTree(r.Storer, h)
}

// TreeObjects returns an unsorted TreeIter with all the trees in the repository
func (r *Repository) TreeObjects() (*object.TreeIter, error) {
	iter, err := r.Storer.IterEncodedObjects(plumbing.TreeObject)
	if err != nil {
		return nil, err
	}

	return object.NewTreeIter(r.Storer, iter), nil
}

// CommitObject return a Commit with the given hash. If not found
// plumbing.ErrObjectNotFound is returned.
func (r *Repository) CommitObject(h plumbing.Hash) (*object.Commit, error) {
	return object.GetCommit(r.Storer, h)
}

// CommitObjects returns an unsorted CommitIter with all the commits in the repository.
func (r *Repository) CommitObjects() (object.CommitIter, error) {
	iter, err := r.Storer.IterEncodedObjects(plumbing.CommitObject)
	if err != nil {
		return nil, err
	}

	return object.NewCommitIter(r.Storer, iter), nil
}

// BlobObject returns a Blob with the given hash. If not found
// plumbing.ErrObjectNotFound is returned.
func (r *Repository) BlobObject(h plumbing.Hash) (*object.Blob, error) {
	return object.GetBlob(r.Storer, h)
}

// BlobObjects returns an unsorted BlobIter with all the blobs in the repository.
func (r *Repository) BlobObjects() (*object.BlobIter, error) {
	iter, err := r.Storer.IterEncodedObjects(plumbing.BlobObject)
	if err != nil {
		return nil, err
	}

	return object.NewBlobIter(r.Storer, iter), nil
}

// TagObject returns a Tag with the given hash. If not found
// plumbing.ErrObjectNotFound is returned. This method only returns
// annotated Tags, no lightweight Tags.
func (r *Repository) TagObject(h plumbing.Hash) (*object.Tag, error) {
	return object.GetTag(r.Storer, h)
}

// TagObjects returns a unsorted TagIter that can step through all of the annotated
// tags in the repository.
func (r *Repository) TagObjects() (*object.TagIter, error) {
	iter, err := r.Storer.IterEncodedObjects(plumbing.TagObject)
	if err != nil {
		return nil, err
	}

	return object.NewTagIter(r.Storer, iter), nil
}

// Object returns an Object with the given hash. If not found
// plumbing.ErrObjectNotFound is returned.
func (r *Repository) Object(t plumbing.ObjectType, h plumbing.Hash) (object.Object, error) {
	obj, err := r.Storer.EncodedObject(t, h)
	if err != nil {
		return nil, err
	}

	return object.DecodeObject(r.Storer, obj)
}

// Objects returns an unsorted ObjectIter with all the objects in the repository.
func (r *Repository) Objects() (*object.ObjectIter, error) {
	iter, err := r.Storer.IterEncodedObjects(plumbing.AnyObject)
	if err != nil {
		return nil, err
	}

	return object.NewObjectIter(r.Storer, iter), nil
}

// Head returns the reference where HEAD is pointing to.
func (r *Repository) Head() (*plumbing.Reference, error) {
	return storer.ResolveReference(r.Storer, plumbing.HEAD)
}

// Reference returns the reference for a given reference name. If resolved is
// true, any symbolic reference will be resolved.
func (r *Repository) Reference(name plumbing.ReferenceName, resolved bool) (
	*plumbing.Reference, error) {

	if resolved {
		return storer.ResolveReference(r.Storer, name)
	}

	return r.Storer.Reference(name)
}

// References returns an unsorted ReferenceIter for all references.
func (r *Repository) References() (storer.ReferenceIter, error) {
	return r.Storer.IterReferences()
}

// Worktree returns a worktree based on the given fs, if nil the default
// worktree will be used.
func (r *Repository) Worktree() (*Worktree, error) {
	if r.wt == nil {
		return nil, ErrIsBareRepository
	}

	return &Worktree{r: r, fs: r.wt}, nil
}

// ResolveRevision resolves revision to corresponding hash.
func (r *Repository) ResolveRevision(rev plumbing.Revision) (*plumbing.Hash, error) {
	p := revision.NewParserFromString(string(rev))

	items, err := p.Parse()

	if err != nil {
		return nil, err
	}

	var commit *object.Commit

	for _, item := range items {
		switch item.(type) {
		case revision.Ref:
			ref, err := storer.ResolveReference(r.Storer, plumbing.ReferenceName(item.(revision.Ref)))

			if err != nil {
				return &plumbing.ZeroHash, err
			}

			h := ref.Hash()

			commit, err = r.CommitObject(h)

			if err != nil {
				return &plumbing.ZeroHash, err
			}
		case revision.CaretPath:
			depth := item.(revision.CaretPath).Depth

			if depth == 0 {
				break
			}

			iter := commit.Parents()

			c, err := iter.Next()

			if err != nil {
				return &plumbing.ZeroHash, err
			}

			if depth == 1 {
				commit = c

				break
			}

			c, err = iter.Next()

			if err != nil {
				return &plumbing.ZeroHash, err
			}

			commit = c
		case revision.TildePath:
			for i := 0; i < item.(revision.TildePath).Depth; i++ {
				c, err := commit.Parents().Next()

				if err != nil {
					return &plumbing.ZeroHash, err
				}

				commit = c
			}
		case revision.CaretReg:
			history := object.NewCommitPreorderIter(commit)

			re := item.(revision.CaretReg).Regexp
			negate := item.(revision.CaretReg).Negate

			var c *object.Commit

			err := history.ForEach(func(hc *object.Commit) error {
				if !negate && re.MatchString(hc.Message) {
					c = hc
					return storer.ErrStop
				}

				if negate && !re.MatchString(hc.Message) {
					c = hc
					return storer.ErrStop
				}

				return nil
			})
			if err != nil {
				return &plumbing.ZeroHash, err
			}

			if c == nil {
				return &plumbing.ZeroHash, fmt.Errorf(`No commit message match regexp : "%s"`, re.String())
			}

			commit = c
		case revision.AtDate:
			history := object.NewCommitPreorderIter(commit)

			date := item.(revision.AtDate).Date

			var c *object.Commit
			err := history.ForEach(func(hc *object.Commit) error {
				if date.Equal(hc.Committer.When.UTC()) || hc.Committer.When.UTC().Before(date) {
					c = hc
					return storer.ErrStop
				}

				return nil
			})
			if err != nil {
				return &plumbing.ZeroHash, err
			}

			if c == nil {
				return &plumbing.ZeroHash, fmt.Errorf(`No commit exists prior to date "%s"`, date.String())
			}

			commit = c
		}
	}

	return &commit.Hash, nil
}
