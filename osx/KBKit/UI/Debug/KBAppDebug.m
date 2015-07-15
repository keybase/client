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

@interface KBAppDebug ()
@property BOOL running;
@end

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

  GHWeakSelf gself = self;
  [topView addSubview:[KBButton buttonWithText:@"Test Log" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{
    gself.running = !gself.running;
    [gself _logDebug:0];
  }]];
}

- (void)_logDebug:(NSTimeInterval)delay {
  GHWeakSelf gself = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, delay * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    DDLogDebug(@"%@", @"Tote bag XOXO cred, whatever retro Etsy American Apparel single-origin coffee sustainable Pitchfork mlkshk quinoa meh. Kale chips plaid crucifix migas, sriracha brunch American Apparel twee. Cray you probably haven't heard of them mustache flannel health goth fingerstache. Beard mlkshk lumbersexual narwhal. Flexitarian art party four dollar toast cred, brunch fixie distillery.");

    if (gself.running) {
      [gself _logDebug:0.5];
    }
  });
}

@end
