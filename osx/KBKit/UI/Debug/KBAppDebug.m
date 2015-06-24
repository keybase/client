//
//  KBAppDebug.m
//  Keybase
//
//  Created by Gabriel on 6/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppDebug.h"

#import "KBDebugViews.h"
#import "KBStyleGuideView.h"
#import "KBDefines.h"

@implementation KBAppDebug

- (void)viewInit {
  [super viewInit];

  YOHBox *topView = [YOHBox box:@{@"spacing": @(10)}];
  [self addSubview:topView];
  [topView addSubview:[KBButton buttonWithText:@"Style Guide" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    KBStyleGuideView *styleGuide = [[KBStyleGuideView alloc] init];
    [styleGuide open:self];
  }]];

  [topView addSubview:[KBButton buttonWithText:@"View Debug/Mocks" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    KBDebugViews *debugViews = [[KBDebugViews alloc] init];
    [debugViews open:self];
  }]];

  [topView addSubview:[KBButton buttonWithText:@"Log (Error)" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    DDLogError(@"%@", KBMakeError(-1, @"Test error message"));
  }]];

  [topView addSubview:[KBButton buttonWithText:@"Log (Warn)" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    DDLogWarn(@"Warning message");
  }]];
}

@end
