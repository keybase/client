package tlf

import (
	"errors"
	"sort"

	"github.com/keybase/client/go/protocol/keybase1"
)

// Handle uniquely identifies top-level folders by readers and
// writers.
//
// TODO: Have separate types for writers vs. readers.
type Handle struct {
	Writers           []keybase1.UserOrTeamID    `codec:"w,omitempty"`
	Readers           []keybase1.UserOrTeamID    `codec:"r,omitempty"`
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`
	ConflictInfo      *HandleExtension           `codec:"ci,omitempty"`
	FinalizedInfo     *HandleExtension           `codec:"fi,omitempty"`
}

// errNoWriters is the error returned by MakeHandle if it is
// passed an empty list of writers.
var errNoWriters = errors.New("Cannot make TLF handle with no writers; need rekey?")

// errInvalidWriter is the error returned by MakeHandle if it
// is passed an invalid writer.
var errInvalidWriter = errors.New("Cannot make TLF handle with invalid writer")

// errInvalidReader is the error returned by MakeHandle if it
// is passed an invalid reader.
var errInvalidReader = errors.New("Cannot make TLF handle with invalid reader")

// UIDList can be used to lexicographically sort UserOrTeamIDs.
type UIDList []keybase1.UserOrTeamID

func (u UIDList) Len() int {
	return len(u)
}

func (u UIDList) Less(i, j int) bool {
	return u[i].Less(u[j])
}

func (u UIDList) Swap(i, j int) {
	u[i], u[j] = u[j], u[i]
}

// SocialAssertionList can be used to lexicographically sort SocialAssertions.
type SocialAssertionList []keybase1.SocialAssertion

func (u SocialAssertionList) Len() int {
	return len(u)
}

func (u SocialAssertionList) Less(i, j int) bool {
	si := u[i].String()
	sj := u[j].String()
	return si < sj
}

func (u SocialAssertionList) Swap(i, j int) {
	u[i], u[j] = u[j], u[i]
}

// MakeHandle creates a Handle from the given list of
// readers and writers. If the given reader list contains just
// keybase1.PUBLIC_UID, then the returned handle will be for a public
// folder. Otherwise, it will be private. PUBLIC_UID shouldn't be in
// any list in any other case.
func MakeHandle(
	writers, readers []keybase1.UserOrTeamID,
	unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion,
	extensions []HandleExtension) (Handle, error) {
	if len(writers) == 0 {
		return Handle{}, errNoWriters
	}

	if writers[0].IsTeamOrSubteam() {
		// Right now we only support single-team private TLFs.
		if len(writers) > 1 || len(unresolvedWriters) != 0 {
			return Handle{}, errInvalidWriter
		} else if len(readers) != 0 || len(unresolvedReaders) != 0 {
			return Handle{}, errInvalidReader
		}
	}

	for i, w := range writers {
		if w == keybase1.PUBLIC_UID {
			return Handle{}, errInvalidWriter
		} else if i > 0 && w.IsTeamOrSubteam() {
			return Handle{}, errInvalidWriter
		}
	}

	// If we have more than one reader, none of them should be the
	// public UID.  And no readers should be a team.
	checkPublic := (len(readers) + len(unresolvedReaders)) > 1
	for _, r := range readers {
		if checkPublic && r == keybase1.PUBLIC_UID {
			return Handle{}, errInvalidReader
		} else if r.IsTeamOrSubteam() {
			return Handle{}, errInvalidReader
		}
	}

	// TODO: Check for overlap between readers and writers, and
	// for duplicates.

	writersCopy := make([]keybase1.UserOrTeamID, len(writers))
	copy(writersCopy, writers)
	sort.Sort(UIDList(writersCopy))

	var readersCopy []keybase1.UserOrTeamID
	if len(readers) > 0 {
		readersCopy = make([]keybase1.UserOrTeamID, len(readers))
		copy(readersCopy, readers)
		sort.Sort(UIDList(readersCopy))
	}

	var unresolvedWritersCopy []keybase1.SocialAssertion
	if len(unresolvedWriters) > 0 {
		unresolvedWritersCopy = make([]keybase1.SocialAssertion, len(unresolvedWriters))
		copy(unresolvedWritersCopy, unresolvedWriters)
		sort.Sort(SocialAssertionList(unresolvedWritersCopy))
	}

	var unresolvedReadersCopy []keybase1.SocialAssertion
	if len(unresolvedReaders) > 0 {
		unresolvedReadersCopy = make([]keybase1.SocialAssertion, len(unresolvedReaders))
		copy(unresolvedReadersCopy, unresolvedReaders)
		sort.Sort(SocialAssertionList(unresolvedReadersCopy))
	}

	conflictInfo, finalizedInfo := HandleExtensionList(extensions).Splat()

	return Handle{
		Writers:           writersCopy,
		Readers:           readersCopy,
		UnresolvedWriters: unresolvedWritersCopy,
		UnresolvedReaders: unresolvedReadersCopy,
		ConflictInfo:      conflictInfo,
		FinalizedInfo:     finalizedInfo,
	}, nil
}

// Type returns the type of TLF this Handle represents.
func (h Handle) Type() Type {
	if len(h.Readers) == 1 &&
		h.Readers[0].Equal(keybase1.PublicUID.AsUserOrTeam()) {
		return Public
	} else if len(h.Writers) == 1 && h.Writers[0].IsTeamOrSubteam() {
		return SingleTeam
	}
	return Private
}

func (h Handle) findUserInList(user keybase1.UserOrTeamID,
	users []keybase1.UserOrTeamID) bool {
	for _, u := range users {
		if u == user {
			return true
		}
	}
	return false
}

// IsWriter returns whether or not the given user is a writer for the
// top-level folder represented by this Handle.
func (h Handle) IsWriter(user keybase1.UserOrTeamID) bool {
	if h.Type() == SingleTeam {
		panic("Can't call Handle.IsWriter() for a single team TLF")
	}
	return h.findUserInList(user, h.Writers)
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this Handle.
func (h Handle) IsReader(user keybase1.UserOrTeamID) bool {
	if h.Type() == SingleTeam {
		panic("Can't call Handle.IsReader() for a single team TLF")
	}
	return h.Type() == Public || h.findUserInList(user, h.Readers) ||
		h.IsWriter(user)
}

// ResolvedUsers returns the concatenation of h.Writers and h.Readers,
// except if the handle is public, the returned list won't contain
// PUBLIC_UID.
func (h Handle) ResolvedUsers() []keybase1.UserOrTeamID {
	var resolvedUsers []keybase1.UserOrTeamID
	resolvedUsers = append(resolvedUsers, h.Writers...)
	if h.Type() == Private {
		resolvedUsers = append(resolvedUsers, h.Readers...)
	}
	return resolvedUsers
}

// HasUnresolvedUsers returns true if this handle has any unresolved
// writers or readers.
func (h Handle) HasUnresolvedUsers() bool {
	return len(h.UnresolvedWriters) > 0 || len(h.UnresolvedReaders) > 0
}

// UnresolvedUsers returns the concatenation of h.UnresolvedWriters
// and h.UnresolvedReaders.
func (h Handle) UnresolvedUsers() []keybase1.SocialAssertion {
	var unresolvedUsers []keybase1.SocialAssertion
	unresolvedUsers = append(unresolvedUsers, h.UnresolvedWriters...)
	unresolvedUsers = append(unresolvedUsers, h.UnresolvedReaders...)
	return unresolvedUsers
}

func uidSliceToSet(s []keybase1.UserOrTeamID) map[keybase1.UserOrTeamID]bool {
	m := make(map[keybase1.UserOrTeamID]bool, len(s))
	for _, u := range s {
		m[u] = true
	}
	return m
}

func assertionSliceToSet(s []keybase1.SocialAssertion) map[keybase1.SocialAssertion]bool {
	m := make(map[keybase1.SocialAssertion]bool, len(s))
	for _, u := range s {
		m[u] = true
	}
	return m
}

func resolveAssertions(
	assertions map[keybase1.SocialAssertion]keybase1.UID,
	unresolved []keybase1.SocialAssertion, resolved []keybase1.UserOrTeamID) (
	map[keybase1.UserOrTeamID]bool, []keybase1.SocialAssertion) {
	resolvedMap := uidSliceToSet(resolved)
	unresolvedMap := assertionSliceToSet(unresolved)
	for a, u := range assertions {
		if unresolvedMap[a] {
			resolvedMap[u.AsUserOrTeam()] = true
			delete(unresolvedMap, a)
		}
	}
	return resolvedMap, assertionSetToSlice(unresolvedMap)
}

func uidSetToSlice(m map[keybase1.UserOrTeamID]bool) (
	s []keybase1.UserOrTeamID) {
	for u := range m {
		s = append(s, u)
	}
	return s
}

func assertionSetToSlice(m map[keybase1.SocialAssertion]bool) (s []keybase1.SocialAssertion) {
	for u := range m {
		s = append(s, u)
	}
	return s
}

// ResolveAssertions creates a new Handle given an existing one with
// while resolving the passed assertions.
func (h Handle) ResolveAssertions(
	assertions map[keybase1.SocialAssertion]keybase1.UID) Handle {
	if len(assertions) == 0 || (len(h.UnresolvedWriters) == 0 && len(h.UnresolvedReaders) == 0) || h.IsFinal() {
		return h
	}
	var resolvedWriters, resolvedReaders map[keybase1.UserOrTeamID]bool
	resolvedWriters, h.UnresolvedWriters = resolveAssertions(assertions, h.UnresolvedWriters, h.Writers)
	resolvedReaders, h.UnresolvedReaders = resolveAssertions(assertions, h.UnresolvedReaders, h.Readers)
	h.Writers = uidSetToSlice(resolvedWriters)
	for _, u := range h.Writers {
		delete(resolvedReaders, u)
	}
	h.Readers = uidSetToSlice(resolvedReaders)
	sort.Sort(UIDList(h.Writers))
	sort.Sort(UIDList(h.Readers))
	sort.Sort(SocialAssertionList(h.UnresolvedWriters))
	sort.Sort(SocialAssertionList(h.UnresolvedReaders))
	return h
}

// Extensions returns a list of extensions for the given handle.
func (h Handle) Extensions() (extensions []HandleExtension) {
	if h.ConflictInfo != nil {
		extensions = append(extensions, *h.ConflictInfo)
	}
	if h.FinalizedInfo != nil {
		extensions = append(extensions, *h.FinalizedInfo)
	}
	return extensions
}

// IsFinal returns true if the handle has been finalized.
func (h Handle) IsFinal() bool {
	return h.FinalizedInfo != nil
}

// IsConflict returns true if the handle is a conflict handle.
func (h Handle) IsConflict() bool {
	return h.ConflictInfo != nil
}
