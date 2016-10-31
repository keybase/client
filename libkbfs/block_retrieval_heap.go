package libkbfs

type blockRetrievalHeap []*blockRetrieval

// Heap methods: do not use directly
func (brh blockRetrievalHeap) Less(i, j int) bool {
	reqI := brh[i]
	reqJ := brh[j]
	if reqI.priority > reqJ.priority {
		return true
	}
	if reqI.priority < reqJ.priority {
		return false
	}
	return reqI.insertionOrder < reqJ.insertionOrder
}

func (brh blockRetrievalHeap) Len() int { return len(brh) }

func (brh blockRetrievalHeap) Swap(i, j int) {
	brh[i], brh[j] = brh[j], brh[i]
	brh[i].index = i
	brh[j].index = j
}

func (brh *blockRetrievalHeap) Push(item interface{}) {
	n := len(*brh)
	retrieval := item.(*blockRetrieval)
	retrieval.index = n
	*brh = append(*brh, retrieval)
}

func (brh *blockRetrievalHeap) Pop() interface{} {
	old := *brh
	n := len(old)
	x := old[n-1]
	x.index = -1
	*brh = old[0 : n-1]
	return x
}
