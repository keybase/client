//
//  KBEnvSelectView.m
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvSelectView.h"

#import "KBButtonView.h"

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

  YOVBox *envs = [YOVBox box];
  [envs kb_setBorderWithColor:KBAppearance.currentAppearance.lineColor width:1.0];
  [contentView addSubview:envs];

//#ifndef DEBUG
  KBImageTextView *viewKeybaseIO = [[KBImageTextView alloc] init];
  [viewKeybaseIO setTitle:@"Keybase.io" info:@"Connects to api.keybase.io" imageURLString:nil imageSize:CGSizeZero];
  [envs addSubview:[KBButtonView buttonViewWithView:viewKeybaseIO targetBlock:^{ self.onSelect(KBRPClientEnvKeybaseIO); }]];

  KBImageTextView *viewLocalhost = [[KBImageTextView alloc] init];
  [viewLocalhost setTitle:@"Localhost" info:@"Connects to localhost:3000" imageURLString:nil imageSize:CGSizeZero];
  [envs addSubview:[KBButtonView buttonViewWithView:viewLocalhost targetBlock:^{ self.onSelect(KBRPClientEnvLocalhost); }]];
//#endif

  KBImageTextView *viewManual = [[KBImageTextView alloc] init];
  [viewManual setTitle:@"Manual" info:@"Manually connect /tmp/keybase-dev.sock" imageURLString:nil imageSize:CGSizeZero];
  [envs addSubview:[KBButtonView buttonViewWithView:viewManual targetBlock:^{ self.onSelect(KBRPClientEnvManual); }]];

  [contentView addSubview:[KBBox spacing:20]];

  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center"}];
  [contentView addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
}

@end
