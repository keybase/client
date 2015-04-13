//
//  KBUserPickerView.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserPickerView.h"

#import "KBSearchResultView.h"
#import "AppDelegate.h"
#import "KBRUtils.h"
#import "KBRunBlocks.h"
#import "KBSearcher.h"
#import "KBUserView.h"
#import "KBPopover.h"

@interface KBUserPickerView ()
@property KBLabel *label;
@property NSTokenField *tokensField;
@property NSMenu *tokenMenu;
@property KBSearchControl *searchControl;
@property NSString *previousValue;

@property KBActivityIndicatorView *progressView;
@property KBSearcher *search;

@property KBPopover *popover;
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
  [_label setText:@"To" font:[NSFont systemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  [self addSubview:_label];

  _tokensField = [[NSTokenField alloc] init];
  _tokensField.tokenStyle = NSRoundedTokenStyle;
  _tokensField.delegate = self;
  _tokensField.font = [NSFont systemFontOfSize:16];
  _tokensField.focusRingType = NSFocusRingTypeNone;
  _tokensField.bordered = NO;
  _tokensField.textColor = KBAppearance.currentAppearance.textColor;
  [self addSubview:_tokensField];

  _progressView = [[KBActivityIndicatorView alloc] init];
  _progressView.lineWidth = 1.0;
  [self addSubview:_progressView];

  _tokenMenu = [[NSMenu alloc] initWithTitle:@""];
  [_tokenMenu insertItem:[[NSMenuItem alloc] initWithTitle:@"Edit" action:@selector(editToken:) keyEquivalent:@""] atIndex:0];

  _searchControl = [[KBSearchControl alloc] init];
  _searchControl.delegate = self;

  GHWeakSelf gself = self;
  _searchResultsView = [KBListView listViewWithPrototypeClass:KBUserView.class rowHeight:56];
  //[_searchResultsView setBorderEnabled:YES];
  _searchResultsView.cellSetBlock = ^(KBUserView *view, KBRUserSummary *userSummary, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [view setUserSummary:userSummary];
  };
  _searchResultsView.onSelect = ^(KBTableView *tableView, NSIndexPath *indexPath, KBRUserSummary *userSummary) {
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
  _popover.contentSize = CGSizeMake(300, 300);

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    x += [layout sizeToFitInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.label].size.width + 8;

    [layout setFrame:CGRectMake(size.width - 24, y, 20, 20) view:yself.progressView];

    CGSize tokenSize = [yself.tokensField sizeThatFits:CGSizeMake(size.width - x - 26, CGFLOAT_MAX)];
    y += [layout setFrame:CGRectMake(x, y, size.width - x, tokenSize.height + 2) view:yself.tokensField].size.height + 10;
    return CGSizeMake(size.width, y);
  }];
}

- (void)cancelOperation:(id)sender {
  [self hideSearch];
}

- (void)updatePickerResults {
  CGFloat contentHeight = [_searchResultsView contentHeight:600];
  _popover.contentSize = CGSizeMake(300, contentHeight);
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
  }
  return NO; // No means let the token field handle it
}

- (BOOL)control:(NSControl *)control textShouldBeginEditing:(NSText *)fieldEditor {
  return YES;
}

- (BOOL)control:(NSControl *)control textShouldEndEditing:(NSText *)fieldEditor {
  [self hideSearch];
  return YES;
}

- (void)editToken:(id)sender {

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
  return _tokenMenu;
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

- (void)showSearch {
  if (!self.popover.isShowing) {
    [self.popover show:_tokensField];
  }
}

- (void)hideSearch {
  [self.popover close];
}

- (void)searchControlShouldOpen:(KBSearchControl *)searchControl {

}

- (void)searchControlShouldClose:(KBSearchControl *)searchControl {
  [self hideSearch];
}

- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(KBSearchResults *)searchResults {
  NSSet *usernames = [NSSet setWithArray:[[_searchResultsView objectsWithoutHeaders] map:^(KBRUserSummary *us) { return us.username; }]];
  NSArray *filtered = [searchResults.results reject:^BOOL(KBRUserSummary *us) { return [usernames containsObject:us.username]; }];
  NSMutableArray *results = [filtered mutableCopy];
  if (searchResults.header && [results count] > 0) [results insertObject:[KBTableViewHeader tableViewHeaderWithTitle:searchResults.header] atIndex:0];
  [_searchResultsView addObjects:results];

  if ([_searchResultsView rowCount] > 0) {
    [self showSearch];
  } else {
    [self hideSearch];
  }
}

- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl {
  [_searchResultsView removeAllObjects];
}

- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled {
  _progressView.animating = progressEnabled;
}

- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query delay:(BOOL)delay completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion {
  if (!_search) _search = [[KBSearcher alloc] init];
  [_search search:query client:self.client remote:delay completion:completion];
}


@end
