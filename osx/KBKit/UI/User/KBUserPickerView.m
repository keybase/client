//
//  KBUserPickerView.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserPickerView.h"

#import "KBDefines.h"
#import "KBRunOver.h"
#import "KBSearcher.h"
#import "KBUserView.h"
#import "KBPopover.h"
#import "KBUserProfileView.h"

@interface KBUserPickerView ()
@property KBLabel *label;
@property NSTokenField *tokensField;
@property KBSearchControl *searchControl;
@property NSString *previousValue;

@property KBActivityIndicatorView *progressView;
@property KBSearcher *search;
@property KBListView *searchResultsView;

@property KBPopover *popover;
@property NSView *popoverInView;
@end

@interface KBUserToken : NSObject
@property NSString *username;
@end

@implementation KBUserToken

+ (instancetype)userTokenWithUsername:(NSString *)username {
  NSParameterAssert(username);
  KBUserToken *t = [[KBUserToken alloc] init];
  t.username = username;
  return t;
}

- (NSString *)description { return NSStringWithFormat(@"%@: %@", [super description], self.username); }

- (id)copyWithZone:(NSZone *)zone {
  KBUserToken *c = [[[self class] alloc] init]; //[super copyWithZone:zone];
  c->_username = [_username copyWithZone:zone];
  return c;
}

@end

@implementation KBUserPickerView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [_label setText:@"To" style:KBTextStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  [self addSubview:_label];

  _tokensField = [[NSTokenField alloc] init];
  _tokensField.tokenStyle = NSTokenStyleRounded;
  _tokensField.delegate = self;
  _tokensField.font = KBAppearance.currentAppearance.textFont;
  _tokensField.focusRingType = NSFocusRingTypeNone;
  _tokensField.bordered = NO;
  _tokensField.textColor = KBAppearance.currentAppearance.textColor;
  [self addSubview:_tokensField];

  _progressView = [[KBActivityIndicatorView alloc] init];
  _progressView.lineWidth = 1.0;
  [self addSubview:_progressView];

  _searchControl = [[KBSearchControl alloc] init];
  _searchControl.delegate = self;

  GHWeakSelf gself = self;
  _searchResultsView = [KBListView listViewWithPrototypeClass:KBUserCell.class rowHeight:56];
  //_searchResultsView.scrollView.borderType = NSBezelBorder;
  _searchResultsView.onSet = ^(KBUserView *view, KBRUserSummary *userSummary, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [view setUserSummary:userSummary];
  };
  _searchResultsView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    KBRUserSummary *userSummary = selection.object;
    if (!userSummary) return;
    [gself commitToken:[KBUserToken userTokenWithUsername:userSummary.username]];
    [gself.searchControl textDidChange:@""];
    [gself focusTokensField];
  };

  _searchResultsView.onUpdate = ^(KBTableView *tableView) {
    [gself updatePickerResults];
  };

  _popover = [[KBPopover alloc] init];
  _popover.contentView = _searchResultsView;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 8;
    CGFloat y = 8;
    if (!yself.label.hidden) {
      x += [layout sizeToFitInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.label].size.width + 8;
    }

    [layout setFrame:CGRectMake(size.width - 24, y, 20, 20) view:yself.progressView];

    CGSize tokenSize = [yself.tokensField sizeThatFits:CGSizeMake(size.width - x - 26, CGFLOAT_MAX)];
    y += [layout setFrame:CGRectMake(x, y - 1, size.width - x, tokenSize.height + 2) view:yself.tokensField].size.height + 6;
    return CGSizeMake(size.width, y);
  }];
}

- (void)cancelOperation:(id)sender {
  [self hideSearch];
}

- (void)updatePickerResults {
  CGFloat contentHeight = [_searchResultsView calculateContentHeightWithMax:0];
  _popover.maxContentSize = CGSizeMake(0, contentHeight);
}

- (void)focusTokensField {
  [self.window makeFirstResponder:_tokensField];
  NSRange range = [[_tokensField currentEditor] selectedRange];
  [[_tokensField currentEditor] setSelectedRange:NSMakeRange(range.length, 0)];
}

- (void)addUsername:(NSString *)username {
  NSMutableArray *tokens = [[_tokensField objectValue] mutableCopy];
  [tokens addObject:[KBUserToken userTokenWithUsername:username]];
  [_tokensField setObjectValue:tokens];
}

- (NSString *)editingToken:(NSString *)defaultValue {
  NSString *token = [[_tokensField objectValue] detect:^(id token) { return [token isKindOfClass:NSString.class]; }];
  return token ? token : defaultValue;
}

- (void)setEditingToken:(NSString *)editingToken {
  NSMutableArray *tokens = [[_tokensField objectValue] mutableCopy];

  NSString *token = [self editingToken:nil];
  if (token) {

    // Because of a bug in NSTokenField we can't update an editing token in the middle of other tokens
    // http://stackoverflow.com/questions/12297858/suggestions-in-popover-for-nstokenfield
    // So we'll add it to the end instead of where it was
    // [tokens replaceObjectAtIndex:[tokens indexOfObject:token] withObject:editingToken];
    [tokens removeObject:token];
    [tokens addObject:editingToken];

  } else {
    [tokens removeObject:token];
  }
  [_tokensField setObjectValue:tokens];
}

- (void)commitEditingToken {
  NSString *editingToken = [self editingToken:nil];
  if (!editingToken) return;

  NSMutableArray *tokens = [[_tokensField objectValue] mutableCopy];
  [tokens removeObject:editingToken];
  [tokens addObject:[KBUserToken userTokenWithUsername:editingToken]];
  [_tokensField setObjectValue:tokens];
}

- (void)commitToken:(KBUserToken *)userToken {
  NSMutableArray *tokens = [[_tokensField objectValue] mutableCopy];
  NSString *editingToken = [self editingToken:nil];
  if (editingToken) {
    [tokens removeObject:editingToken];
  }
  if (userToken) {
    [tokens addObject:userToken];
  }
  [_tokensField setObjectValue:tokens];
}

- (NSArray *)usernames {
  return [_tokensField.objectValue map:^(id token) { return [token isKindOfClass:KBUserToken.class] ? [token username] : token; }];
}

- (void)controlTextDidChange:(NSNotification *)notification {
  //DDLogDebug(@"Change: %@", [[self editingToken:@""] gh_strip]);
  [_searchControl textDidChange:[[self editingToken:@""] gh_strip]];
  [self.viewLayout setNeedsLayout];
  [self.delegate userPickerViewDidUpdate:self];
}

//- (BOOL)control:(NSControl *)control textShouldBeginEditing:(NSText *)fieldEditor {
//  return YES;
//}
//
//- (BOOL)control:(NSControl *)control textShouldEndEditing:(NSText *)fieldEditor {
//  return YES;
//}

- (void)controlTextDidEndEditing:(NSNotification *)notification {
  // If field is ending editing because of search list view selection, that will hide it.
  // This gives the search list view the chance to select and deselect visibly.
  if (!_searchResultsView.isSelectionChanging) [self hideSearch];
}

- (NSTokenStyle)tokenField:(NSTokenField *)tokenField styleForRepresentedObject:(id)representedObject {
  if ([representedObject isKindOfClass:NSString.class]) {
    return NSPlainTextTokenStyle;
  } else {
    return NSRoundedTokenStyle;
  }
}

- (BOOL)control:(NSControl *)control textView:(NSTextView *)textView doCommandBySelector:(SEL)commandSelector {
  //DDLogDebug(@"Command: %@, (%@)", NSStringFromSelector(commandSelector), [_tokensField objectValue]);

  if (commandSelector == @selector(insertNewline:)) {
    return NO; // No means let the token field handle it
  } else if (commandSelector == @selector(moveUp:)) {
    if (_searchResultsView.view.selectedRow == 0) {
      [self setEditingToken:_previousValue];
      [_searchResultsView.view deselectRow:0];
      return YES;
    }

    if ([_searchResultsView nextRowUp] != NSNotFound) {
      [_searchResultsView moveUp:self];
      KBRUserSummary *searchResult = _searchResultsView.selectedObject;
      [self setEditingToken:searchResult.username];
    }
    return YES;
  } else if (commandSelector == @selector(moveDown:)) {
    if ([_searchResultsView nextRowDown] != NSNotFound) {
      if (_searchResultsView.view.selectedRow < 0) {
        _previousValue = [self editingToken:nil];
        DDLogDebug(@"Previous value: %@", _previousValue);
      }
      [_searchResultsView moveDown:self];
      KBRUserSummary *searchResult = _searchResultsView.selectedObject;
      if (searchResult) {
        [self setEditingToken:searchResult.username];
      }
    }
    return YES;
  } else if (commandSelector == @selector(insertTab:)) {
    [self commitEditingToken];
    [self.window makeFirstResponder:[self nextKeyView]];
  }
  return NO; // No means let the token field handle it
}

- (void)viewToken:(id)sender {
  id obj = [sender representedObject];
  if ([obj isKindOfClass:KBUserToken.class]) {
    NSString *username = [obj username];
    KBUserProfileView *trackView = [[KBUserProfileView alloc] init];
    trackView.popup = YES;
    trackView.fromWindow = (KBWindow *)[self window];
    [trackView openPopupWindow];

    [trackView setUsername:username client:self.client];
  }
}

- (void)removeToken:(id)sender {
  id obj = [sender representedObject];
  NSArray *tokens = [_tokensField objectValue];
  tokens = [tokens reject:^(id token) { return [token isEqualTo:obj]; }];
  [_tokensField setObjectValue:tokens];
}

#pragma mark NSTokenField

- (NSArray *)tokenField:(NSTokenField *)tokenField shouldAddObjects:(NSArray *)tokens atIndex:(NSUInteger)index {
  return [tokens map:^(NSString *s) {
    KBUserToken *token = [[KBUserToken alloc] init];
    token.username = s;
    return token;
  }];
}

- (BOOL)tokenField:(NSTokenField *)tokenField hasMenuForRepresentedObject:(id)representedObject {
  return YES;
}

- (NSMenu *)tokenField:(NSTokenField *)tokenField menuForRepresentedObject:(id)representedObject {
  NSMenu *tokenMenu = [[NSMenu alloc] initWithTitle:@""];
  NSMenuItem *viewItem = [[NSMenuItem alloc] initWithTitle:@"View" action:@selector(viewToken:) keyEquivalent:@""];
  viewItem.representedObject = representedObject;
  [tokenMenu addItem:viewItem];
  NSMenuItem *removeItem = [[NSMenuItem alloc] initWithTitle:@"Remove" action:@selector(removeToken:) keyEquivalent:@""];
  removeItem.representedObject = representedObject;
  [tokenMenu addItem:removeItem];
  return tokenMenu;
}

- (id)tokenField:(NSTokenField *)tokenField representedObjectForEditingString:(NSString *)editingString {
  return editingString;
}

- (NSString *)tokenField:(NSTokenField *)tokenField displayStringForRepresentedObject:(id)representedObject {
  if ([representedObject isKindOfClass:KBUserToken.class]) {
    return [representedObject username] ? [representedObject username] : @"";
  } else {
    return representedObject;
  }
}

#pragma mark Search

- (void)setResultsView:(NSView *)resultsView {
  _popoverInView = resultsView;
}

- (void)setSearchResultsFrame:(CGRect)searchResultsFrame inView:(NSView *)inView {
  [self setResultsView:inView];
  CGRect rect = searchResultsFrame;
  rect.origin.y += self.bounds.size.height;
  [self.popover setContentRect:rect];
}

- (void)showSearch {
  if (!self.popover.isShowing && [KBTextField isFocused:_tokensField]) {
    [self.popover showAboveView:_popoverInView options:KBPopoverOptionsShadow];
    [self.delegate userPickerView:self didUpdateSearch:YES];
  }
}

- (void)hideSearch {
  [self.popover hide];
  _progressView.animating = NO;
  [self.delegate userPickerView:self didUpdateSearch:NO];
}

- (void)searchControlShouldOpen:(KBSearchControl *)searchControl {

}

- (void)searchControlShouldClose:(KBSearchControl *)searchControl {
  [self hideSearch];
}

- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(KBSearchResults *)searchResults {
  // Filter out usernames that have already been selected or are already in the search results list
  NSMutableArray *usernamesToIgnore = [NSMutableArray array];
  [usernamesToIgnore addObjectsFromArray:[[_searchResultsView objectsWithoutHeaders] map:^(KBRUserSummary *us) { return us.username; }]];
  [usernamesToIgnore addObjectsFromArray:[self usernames]];
  NSArray *filtered = [searchResults.results reject:^BOOL(KBRUserSummary *us) { return [usernamesToIgnore containsObject:us.username]; }];
  NSMutableArray *results = [filtered mutableCopy];

  if (searchResults.header && [results count] > 0) [results insertObject:[KBTableViewHeader tableViewHeaderWithTitle:searchResults.header] atIndex:0];
  // Datasource might have been altered without reload here (so animations won't work, see reloadDelay)
  [_searchResultsView addObjects:results animation:NSTableViewAnimationEffectNone];

  if ([_searchResultsView rowCount] > 0) {
    [self showSearch];
  } else {
    [self hideSearch];
  }
}

- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl {
  DDLogDebug(@"Clear results");
  //[_searchResultsView removeAllObjects];
  [_searchResultsView.dataSource removeAllObjects];
  [_search reloadDelay:_searchResultsView];
}

- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled {
  _progressView.animating = progressEnabled;
}

- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query delay:(BOOL)delay completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion {
  if (!_search) _search = [[KBSearcher alloc] init];
  [_search search:query client:self.client remote:delay completion:completion];
}

@end
