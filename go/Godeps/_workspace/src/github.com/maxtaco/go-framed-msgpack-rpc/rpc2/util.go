package rpc2

import ()

type Errors struct {
	v []error
}

func (es *Errors) Push(e error) bool {
	if e != nil {
		es.v = append(es.v, e)
		return false
	} else {
		return true
	}
}

func (e *Errors) Error() error {
	if len(e.v) > 0 {
		return e.v[0]
	} else {
		return nil
	}
}

func MakeMethodName(prot string, method string) string {
	if len(prot) == 0 {
		return method
	} else {
		return prot + "." + method
	}
}

func SplitMethodName(n string) (p string, m string) {
	for i := len(n) - 1; i >= 0; i-- {
		if n[i] == '.' {
			p = n[0:i]
			if i < len(n)-1 {
				m = n[(i + 1):]
			}
			return
		}
	}
	m = n
	return
}
