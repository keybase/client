//
//  KBFolderAddView.m
//  Keybase
//
//  Created by Gabriel on 7/20/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBFolderAddView.h"

#import "KBUserPickerView.h"

@interface KBFolderAddView () <KBUserPickerViewDelegate>
@property YOView *resultsView;
@property KBUserPickerView *userPickerView;
@end

@implementation KBFolderAddView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;
  YOVBox *topView = [YOVBox box];
  {
    YOVBox *header = [YOVBox box:@{@"insets": @(10)}];
    [header kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
    {
      KBLabel *hintLabel = [[KBLabel alloc] init];
      [hintLabel setText:@"Who do you want to have access to this folder?" style:KBTextStyleDefault];
      [header addSubview:hintLabel];

    }
    [topView addSubview:header];
    [topView addSubview:[KBBox horizontalLine]];

    _userPickerView = [[KBUserPickerView alloc] init];
    _userPickerView.delegate = self;
    _userPickerView.label.hidden = YES;
    [topView addSubview:_userPickerView];
    [topView addSubview:[KBBox horizontalLine]];
  }
  [self addSubview:topView];

  _resultsView = [YOView view];
  [self addSubview:_resultsView];

  YOVBox *bottomView = [YOVBox box];
  [bottomView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  {
    [bottomView addSubview:[KBBox horizontalLine]];
    YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"insets": @(10), @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
    {
      KBButton *cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      cancelButton.targetBlock = ^{ self.close(self); };
      [rightButtons addSubview:cancelButton];

      KBButton *button = [KBButton buttonWithText:@"OK" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      button.targetBlock = ^{ self.completion(gself.userPickerView.usernames); };
      [rightButtons addSubview:button];
    }
    [bottomView addSubview:rightButtons];
  }
  [self addSubview:bottomView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_resultsView top:@[topView] bottom:@[bottomView]];
}

- (void)layout {
  [super layout];
  CGFloat y = _userPickerView.frame.origin.y + 1;
  [_userPickerView setSearchResultsFrame:CGRectMake(0, y, _resultsView.frame.size.width, _resultsView.frame.size.height) inView:self];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  [_userPickerView setClient:client];
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView { }

- (void)userPickerView:(KBUserPickerView *)userPickerView didUpdateSearch:(BOOL)visible { }

@end