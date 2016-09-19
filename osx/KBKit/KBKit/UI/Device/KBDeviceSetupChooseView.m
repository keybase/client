//
//  KBDeviceSetupChooseView.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceSetupChooseView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

#import "KBRPC.h"
#import "KBDeviceSignerOption.h"

@implementation KBDeviceSetupChooseView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  
  YOView *contentView = [[YOView alloc] init];
  [self addSubview:contentView];

  YOVBox *topView = [YOVBox box:@{@"spacing":@"10", @"insets": @"0,10,0,10"}];
  [contentView addSubview:topView];
  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Device Setup" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [topView addSubview:header];

  KBLabel *infoLabel = [[KBLabel alloc] init];
  [infoLabel setText:@"This is the first time you've logged into this computer. You need to setup and verify this installation of Keybase. Which method do you want to use?" style:KBTextStyleDefault];
  [topView addSubview:infoLabel];

  _deviceSignerView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:0];
  _deviceSignerView.scrollView.borderType = NSBezelBorder;

  _deviceSignerView.onSet = ^(KBImageTextView *view, KBDeviceSignerOption *option, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    view.tintImageForStyle = YES;
    [view setTitle:option.title info:option.info image:option.image lineBreakMode:NSLineBreakByClipping];
  };
  [contentView addSubview:_deviceSignerView];

  YOHBox *bottomView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  [contentView addSubview:bottomView];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [bottomView addSubview:_cancelButton];
  _selectButton = [KBButton buttonWithText:@"Select" style:KBButtonStylePrimary];
  [bottomView addSubview:_selectButton];

  contentView.viewLayout = [YOVBorderLayout layoutWithCenter:_deviceSignerView top:@[topView] bottom:@[bottomView] insets:UIEdgeInsetsMake(40, 40, 40, 40) spacing:20 maxSize:CGSizeMake(600,0)];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)setDevices:(NSArray *)devices hasPGP:(BOOL)hasPGP {
  NSMutableArray *deviceSignerOptions = [NSMutableArray array];
  for (KBRDevice *device in devices) {
    [deviceSignerOptions addObject:[KBDeviceSignerOption deviceWithDevice:device]];
  }
  if (hasPGP) [deviceSignerOptions addObject:[KBDeviceSignerOption PGP]];

  [_deviceSignerView setObjects:deviceSignerOptions];
}

@end
