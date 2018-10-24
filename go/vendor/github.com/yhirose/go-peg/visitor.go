package peg

// visitor
type visitor interface {
	visitSequence(ope *sequence)
	visitPrioritizedChoice(ope *prioritizedChoice)
	visitZeroOrMore(ope *zeroOrMore)
	visitOneOrMore(ope *oneOrMore)
	visitOption(ope *option)
	visitAndPredicate(ope *andPredicate)
	visitNotPredicate(ope *notPredicate)
	visitLiteralString(ope *literalString)
	visitCharacterClass(ope *characterClass)
	visitAnyCharacter(ope *anyCharacter)
	visitTokenBoundary(ope *tokenBoundary)
	visitIgnore(ope *ignore)
	visitUser(ope *user)
	visitReference(ope *reference)
	visitRule(ope *Rule)
	visitWhitespace(ope *whitespace)
	visitExpression(ope *expression)
}

// visitorBase
type visitorBase struct {
}

func (v *visitorBase) visitSequence(ope *sequence)                   {}
func (v *visitorBase) visitPrioritizedChoice(ope *prioritizedChoice) {}
func (v *visitorBase) visitZeroOrMore(ope *zeroOrMore)               {}
func (v *visitorBase) visitOneOrMore(ope *oneOrMore)                 {}
func (v *visitorBase) visitOption(ope *option)                       {}
func (v *visitorBase) visitAndPredicate(ope *andPredicate)           {}
func (v *visitorBase) visitNotPredicate(ope *notPredicate)           {}
func (v *visitorBase) visitLiteralString(ope *literalString)         {}
func (v *visitorBase) visitCharacterClass(ope *characterClass)       {}
func (v *visitorBase) visitAnyCharacter(ope *anyCharacter)           {}
func (v *visitorBase) visitTokenBoundary(ope *tokenBoundary)         {}
func (v *visitorBase) visitIgnore(ope *ignore)                       {}
func (v *visitorBase) visitUser(ope *user)                           {}
func (v *visitorBase) visitReference(ope *reference)                 {}
func (v *visitorBase) visitRule(ope *Rule)                           {}
func (v *visitorBase) visitWhitespace(ope *whitespace)               {}
func (v *visitorBase) visitExpression(ope *expression)               {}

// tokenChecker
type tokenChecker struct {
	*visitorBase
	hasTokenBoundary bool
	hasRule          bool
}

func (v *tokenChecker) visitSequence(ope *sequence) {
	for _, o := range ope.opes {
		o.accept(v)
	}
}
func (v *tokenChecker) visitPrioritizedChoice(ope *prioritizedChoice) {
	for _, o := range ope.opes {
		o.accept(v)
	}
}
func (v *tokenChecker) visitZeroOrMore(ope *zeroOrMore)       { ope.ope.accept(v) }
func (v *tokenChecker) visitOneOrMore(ope *oneOrMore)         { ope.ope.accept(v) }
func (v *tokenChecker) visitOption(ope *option)               { ope.ope.accept(v) }
func (v *tokenChecker) visitTokenBoundary(ope *tokenBoundary) { v.hasTokenBoundary = true }
func (v *tokenChecker) visitIgnore(ope *ignore)               { ope.ope.accept(v) }
func (v *tokenChecker) visitReference(ope *reference) {
	if ope.args != nil {
		ope.rule.accept(v)
		for _, arg := range ope.args {
			arg.accept(v)
		}
	} else {
		v.hasRule = true
	}
}
func (v *tokenChecker) visitWhitespace(ope *whitespace) { ope.ope.accept(v) }
func (v *tokenChecker) visitExpression(ope *expression) { ope.atom.accept(v) }

func (v *tokenChecker) isToken() bool {
	return v.hasTokenBoundary || !v.hasRule
}

// detectLeftRecursion
type detectLeftRecursion struct {
	*visitorBase
	pos    int
	name   string
	params []string
	refs   map[string]bool
	done   bool
}

func (v *detectLeftRecursion) visitSequence(ope *sequence) {
	for _, o := range ope.opes {
		o.accept(v)
		if v.done {
			break
		} else if v.pos != -1 {
			v.done = true
			break
		}
	}
}
func (v *detectLeftRecursion) visitPrioritizedChoice(ope *prioritizedChoice) {
	for _, o := range ope.opes {
		o.accept(v)
		if v.pos != -1 {
			v.done = true
			break
		}
	}
}
func (v *detectLeftRecursion) visitZeroOrMore(ope *zeroOrMore)         { ope.ope.accept(v); v.done = false }
func (v *detectLeftRecursion) visitOneOrMore(ope *oneOrMore)           { ope.ope.accept(v); v.done = true }
func (v *detectLeftRecursion) visitOption(ope *option)                 { ope.ope.accept(v); v.done = false }
func (v *detectLeftRecursion) visitAndPredicate(ope *andPredicate)     { ope.ope.accept(v); v.done = false }
func (v *detectLeftRecursion) visitNotPredicate(ope *notPredicate)     { ope.ope.accept(v); v.done = false }
func (v *detectLeftRecursion) visitLiteralString(ope *literalString)   { v.done = len(ope.lit) > 0 }
func (v *detectLeftRecursion) visitCharacterClass(ope *characterClass) { v.done = true }
func (v *detectLeftRecursion) visitAnyCharacter(ope *anyCharacter)     { v.done = true }
func (v *detectLeftRecursion) visitTokenBoundary(ope *tokenBoundary)   { ope.ope.accept(v) }
func (v *detectLeftRecursion) visitIgnore(ope *ignore)                 { ope.ope.accept(v) }
func (v *detectLeftRecursion) visitReference(ope *reference) {
	if ope.name == v.name {
		v.pos = ope.pos
	} else if _, ok := v.refs[ope.name]; !ok {
		v.refs[ope.name] = true
		if ope.rule != nil {
			ope.rule.accept(v)
		}
	}
	v.done = true
}
func (v *detectLeftRecursion) visitRule(ope *Rule)             { ope.Ope.accept(v) }
func (v *detectLeftRecursion) visitWhitespace(ope *whitespace) { ope.ope.accept(v) }
func (v *detectLeftRecursion) visitExpression(ope *expression) { ope.atom.accept(v) }

// referenceChecker
type referenceChecker struct {
	*visitorBase
	grammar  map[string]*Rule
	params   []string
	errorPos map[string]int
	errorMsg map[string]string
}

func (v *referenceChecker) visitSequence(ope *sequence) {
	for _, o := range ope.opes {
		o.accept(v)
	}
}
func (v *referenceChecker) visitPrioritizedChoice(ope *prioritizedChoice) {
	for _, o := range ope.opes {
		o.accept(v)
	}
}
func (v *referenceChecker) visitZeroOrMore(ope *zeroOrMore)       { ope.ope.accept(v) }
func (v *referenceChecker) visitOneOrMore(ope *oneOrMore)         { ope.ope.accept(v) }
func (v *referenceChecker) visitOption(ope *option)               { ope.ope.accept(v) }
func (v *referenceChecker) visitAndPredicate(ope *andPredicate)   { ope.ope.accept(v) }
func (v *referenceChecker) visitNotPredicate(ope *notPredicate)   { ope.ope.accept(v) }
func (v *referenceChecker) visitTokenBoundary(ope *tokenBoundary) { ope.ope.accept(v) }
func (v *referenceChecker) visitIgnore(ope *ignore)               { ope.ope.accept(v) }
func (v *referenceChecker) visitReference(ope *reference) {
	for _, param := range v.params {
		if param == ope.name {
			return
		}
	}

	if r, ok := v.grammar[ope.name]; !ok {
		v.errorPos[ope.name] = ope.pos
		v.errorMsg[ope.name] = "'" + ope.name + "' is not defined."
	} else if r.Parameters != nil {
		if ope.args == nil || len(ope.args) != len(r.Parameters) {
			v.errorPos[ope.name] = ope.pos
			v.errorMsg[ope.name] = "incorrect number of arguments."
		}
	} else {
		if ope.args != nil {
			v.errorPos[ope.name] = ope.pos
			v.errorMsg[ope.name] = "'" + ope.name + "' is not macro."
		}
	}
}
func (v *referenceChecker) visitRule(ope *Rule)             { ope.Ope.accept(v) }
func (v *referenceChecker) visitWhitespace(ope *whitespace) { ope.ope.accept(v) }
func (v *referenceChecker) visitExpression(ope *expression) { ope.atom.accept(v) }

// linkReferences
type linkReferences struct {
	*visitorBase
	parameters []string
	grammar    map[string]*Rule
}

func (v *linkReferences) visitSequence(ope *sequence) {
	for _, o := range ope.opes {
		o.accept(v)
	}
}
func (v *linkReferences) visitPrioritizedChoice(ope *prioritizedChoice) {
	for _, o := range ope.opes {
		o.accept(v)
	}
}
func (v *linkReferences) visitZeroOrMore(ope *zeroOrMore)       { ope.ope.accept(v) }
func (v *linkReferences) visitOneOrMore(ope *oneOrMore)         { ope.ope.accept(v) }
func (v *linkReferences) visitOption(ope *option)               { ope.ope.accept(v) }
func (v *linkReferences) visitAndPredicate(ope *andPredicate)   { ope.ope.accept(v) }
func (v *linkReferences) visitNotPredicate(ope *notPredicate)   { ope.ope.accept(v) }
func (v *linkReferences) visitTokenBoundary(ope *tokenBoundary) { ope.ope.accept(v) }
func (v *linkReferences) visitIgnore(ope *ignore)               { ope.ope.accept(v) }
func (v *linkReferences) visitReference(ope *reference) {
	if r, ok := v.grammar[ope.name]; ok {
		ope.rule = r
	} else {
		for i, param := range v.parameters {
			if param == ope.name {
				ope.iarg = i
				break
			}
		}
	}
	for _, arg := range ope.args {
		arg.accept(v)
	}
}
func (v *linkReferences) visitRule(ope *Rule)             { ope.Ope.accept(v) }
func (v *linkReferences) visitWhitespace(ope *whitespace) { ope.ope.accept(v) }
func (v *linkReferences) visitExpression(ope *expression) { ope.atom.accept(v) }

// findReference
type findReference struct {
	*visitorBase
	args   []operator
	params []string
	ope    operator
}

func (v *findReference) visitSequence(ope *sequence) {
	var opes []operator
	for _, o := range ope.opes {
		o.accept(v)
		opes = append(opes, v.ope)
	}
	v.ope = SeqCore(opes)
}
func (v *findReference) visitPrioritizedChoice(ope *prioritizedChoice) {
	var opes []operator
	for _, o := range ope.opes {
		o.accept(v)
		opes = append(opes, v.ope)
	}
	v.ope = ChoCore(opes)
}
func (v *findReference) visitZeroOrMore(ope *zeroOrMore) {
	ope.ope.accept(v)
	v.ope = Zom(v.ope)
}
func (v *findReference) visitOneOrMore(ope *oneOrMore) {
	ope.ope.accept(v)
	v.ope = Oom(v.ope)
}
func (v *findReference) visitOption(ope *option) {
	ope.ope.accept(v)
	v.ope = Opt(v.ope)
}
func (v *findReference) visitAndPredicate(ope *andPredicate) {
	ope.ope.accept(v)
	v.ope = Apd(v.ope)
}
func (v *findReference) visitNotPredicate(ope *notPredicate) {
	ope.ope.accept(v)
	v.ope = Npd(v.ope)
}
func (v *findReference) visitLiteralString(ope *literalString) {
	v.ope = ope
}
func (v *findReference) visitCharacterClass(ope *characterClass) {
	v.ope = ope
}
func (v *findReference) visitAnyCharacter(ope *anyCharacter) {
	v.ope = ope
}
func (v *findReference) visitTokenBoundary(ope *tokenBoundary) {
	ope.ope.accept(v)
	v.ope = Tok(v.ope)
}
func (v *findReference) visitIgnore(ope *ignore) {
	ope.ope.accept(v)
	v.ope = Ign(v.ope)
}
func (v *findReference) visitUser(ope *user) {
	v.ope = ope
}
func (v *findReference) visitReference(ope *reference) {
	for i, arg := range v.args {
		name := v.params[i]
		if name == ope.name {
			v.ope = arg
			return
		}
	}
	v.ope = ope
}
func (v *findReference) visitWhitespace(ope *whitespace) {
	ope.ope.accept(v)
	v.ope = Wsp(v.ope)
}
func (v *findReference) visitExpression(ope *expression) {
	ope.atom.accept(v)
	v.ope = ope
}
