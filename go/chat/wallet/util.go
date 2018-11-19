package wallet

func findNextAt(xss []rune, start int, xs []rune, behavior newlineBehavior) int {
	nextIdx := indexRunes(xss[start:], xs)
	if nextIdx == -1 {
		return -1
	}
	if behavior == multiLine {
		return nextIdx + start
	}
	newlineIdx := indexRunes(xss[start:], newline)
	if newlineIdx == -1 || nextIdx < newlineIdx {
		return nextIdx + start
	}
	return -1
}

func startsWithAt(xss []rune, start int, xs []rune) bool {
	return start < len(xss) && indexRunes(xss[start:], xs) == 0
}

func indexRunes(xss []rune, xs []rune) int {
	for i := range xss {
		found := false
		if i+len(xs) <= len(xss) {
			found = true
			for j := range xs {
				if xss[i+j] != xs[j] {
					found = false
					break
				}
			}
		}
		if found {
			return i
		}
	}
	return -1
}
