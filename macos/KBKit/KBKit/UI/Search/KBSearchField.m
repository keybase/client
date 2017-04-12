//
//  KBSearchField.m
//  Keybase
//
//  Created by Gabriel on 3/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearchField.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBSearchField () <NSSearchFieldDelegate>
@property NSSearchField *searchField;
@end

@implementation KBSearchField

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
  [self textDidChange:searchText];
}

- (BOOL)control:(NSControl *)control textShouldBeginEditing:(NSText *)fieldEditor {
  return YES;
}

- (BOOL)control:(NSControl *)control textShouldEndEditing:(NSText *)fieldEditor {
  return YES;
}

@end
