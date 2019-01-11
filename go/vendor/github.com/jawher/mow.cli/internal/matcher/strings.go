package matcher

func removeStringAt(idx int, arr []string) []string {
	res := make([]string, len(arr)-1)
	copy(res, arr[:idx])
	copy(res[idx:], arr[idx+1:])
	return res
}

func removeStringsBetween(from, to int, arr []string) []string {
	res := make([]string, len(arr)-(to-from+1))
	copy(res, arr[:from])
	copy(res[from:], arr[to+1:])
	return res
}

func replaceStringAt(idx int, with string, arr []string) []string {
	res := make([]string, len(arr))
	copy(res, arr[:idx])
	res[idx] = with
	copy(res[idx+1:], arr[idx+1:])
	return res
}
