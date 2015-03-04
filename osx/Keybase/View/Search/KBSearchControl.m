//
//  KBSearchControl.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearchControl.h"

@interface KBSearchControl ()
@property NSSearchField *searchField;
@property NSString *searchText;
@end

@implementation KBSearchControl

- (void)viewInit {
  [super viewInit];

  _searchField = [[NSSearchField alloc] init];
  _searchField.delegate = self;
  _searchField.placeholderString = @"Search";
  _searchField.sendsWholeSearchString = YES;
  [_searchField.cell setMaximumRecents:20];
  [self addSubview:_searchField];

  self.viewLayout = [YOLayout fill:_searchField];
}

- (void)controlTextDidChange:(NSNotification *)notification {
  //[self.window makeFirstResponder:_searchField];
  NSString *searchText = [[_searchField stringValue] gh_strip];
  [self search:searchText];
}

- (BOOL)control:(NSControl *)control textShouldBeginEditing:(NSText *)fieldEditor {
  return YES;
}

- (BOOL)control:(NSControl *)control textShouldEndEditing:(NSText *)fieldEditor {
  return YES;
}

- (void)setSearchResults:(NSArray *)searchResults {
  [self.delegate searchControl:self progressEnabled:NO];
  [self.delegate searchControl:self shouldDisplaySearchResults:searchResults];
}

- (void)clearSearchResults {
  [self.delegate searchControl:self progressEnabled:NO];
  [self.delegate searchControlShouldClearSearchResults:self];
}

- (void)search:(NSString *)searchText {
  _searchText = searchText;
  [self _searchRemoteDelay:searchText];
}

- (void)_searchRemoteDelay:(NSString *)searchText {
  GHWeakSelf blockSelf = self;
  _searchText = searchText;

  if (!searchText || [searchText length] < 2) {
    [self clearSearchResults];
    return;
  }

  [self.delegate searchControl:self progressEnabled:YES];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 700 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
    if ([blockSelf.searchText isEqual:searchText]) {
      [blockSelf _searchRemote:searchText];
    }
  });
}

- (void)_searchRemote:(NSString *)searchText {
  _searchText = searchText;

  [self.delegate searchControl:self progressEnabled:YES];

  GHWeakSelf gself = self;
  GHDebug(@"Search (API): %@", searchText);

  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    [self.delegate searchControl:self shouldSearchWithQuery:searchText completion:^(NSError *error, NSArray *searchResults) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if ([gself.searchText isEqual:searchText]) {
          if (error) {
            [gself clearSearchResults];
            return;
          }
          [gself setSearchResults:searchResults];
        }
      });
    }];
  });
}

@end
