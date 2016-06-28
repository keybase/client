package gregor

type FastLookupState struct {
	State
	table map[string]Item
}

func NewFastLookupState(state State, table map[string]Item) FastLookupState {
	return FastLookupState{
		State: state,
		table: table,
	}
}

func (fs FastLookupState) GetItem(msgID MsgID) (Item, bool) {
	if item, ok := fs.table[msgID.String()]; ok {
		return item, true
	}
	return nil, false
}

func (fs FastLookupState) Export() (ProtocolState, error) {
	return fs.State.Export()
}

func (fs FastLookupState) Items() (Item, bool) {
	return fs.Items()
}

func (fs FastLookupState) ItemsInCategory(c Category) ([]Item, error) {
	return fs.ItemsInCategory(c)
}

func (fs FastLookupState) ItemsWithCategoryPrefix(c Category) ([]Item, error) {
	return fs.ItemsWithCategoryPrefix(c)
}

func (fs FastLookupState) Marshal() ([]byte, error) {
	return fs.Marshal()
}

func (fs FastLookupState) Hash() ([]byte, error) {
	return fs.Hash()
}
