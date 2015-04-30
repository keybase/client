//
//  KBFolderUsersView.m
//  Keybase
//
//  Created by Gabriel on 4/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFolderUsersView.h"

#import "KBFolderUsersListView.h"

@interface KBFolderUsersView ()
@property KBFolderUsersListView *folderUsersListView;
@end

@implementation KBFolderUsersView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _folderUsersListView = [[KBFolderUsersListView alloc] init];
  [self addSubview:_folderUsersListView];

  YOView *footerView = [[YOView alloc] init];
  [self addSubview:footerView];
  KBButton *saveButton = [KBButton buttonWithText:@"Save" style:KBButtonStylePrimary];
  [footerView addSubview:saveButton];
  footerView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts layoutForButton:saveButton cancelButton:nil horizontalAlignment:KBHorizontalAlignmentRight]];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_folderUsersListView top:nil bottom:@[footerView] insets:UIEdgeInsetsMake(20, 20, 20, 20)spacing:10];
}

@end
