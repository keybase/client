//
//  KBAppDebug.m
//  Keybase
//
//  Created by Gabriel on 6/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppDebug.h"

#import "KBMockViews.h"
#import "KBStyleGuideView.h"

@implementation KBAppDebug

- (void)viewInit {
  [super viewInit];

  YOHBox *topView = [YOHBox box:@{@"spacing": @(10)}];
  [self addSubview:topView];
  [topView addSubview:[KBButton buttonWithText:@"Style Guide" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    KBStyleGuideView *styleGuide = [[KBStyleGuideView alloc] init];
    [styleGuide open:self];
  }]];

  [topView addSubview:[KBButton buttonWithText:@"Mocks" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    KBMockViews *mockViews = [[KBMockViews alloc] init];
    [mockViews open:self];
  }]];
}

@end
