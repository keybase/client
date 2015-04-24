//
//  KBEnvSelectView.m
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvSelectView.h"

#import "KBButtonView.h"
#import "KBEnvironment.h"

@implementation KBEnvSelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box:@{@"maxSize": @"400,0"}];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Choose an Environment" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  [contentView addSubview:[KBBox spacing:20]];

  YOVBox *envsView = [YOVBox box];
  [envsView kb_setBorderWithColor:KBAppearance.currentAppearance.lineColor width:1.0];
  [contentView addSubview:envsView];

  NSArray *envs = @[[KBEnvironment env:KBEnvKeybaseIO], [KBEnvironment env:KBEnvLocalhost], [KBEnvironment env:KBEnvManual]];

  for (KBEnvironment *env in envs) {
    KBImageTextCell *view = [[KBImageTextCell alloc] init];
    [view setTitle:env.title info:[env.home stringByAbbreviatingWithTildeInPath] imageURLString:nil imageSize:CGSizeZero];
    [envsView addSubview:[KBButtonView buttonViewWithView:view targetBlock:^{ self.onSelect(env); }]];
  }

  [contentView addSubview:[KBBox spacing:20]];

  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center"}];
  [contentView addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
}

@end
