//
//  KBDeviceSetupChooseView.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceSetupChooseView.h"

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

  _deviceSignerView = [KBListView listViewWithPrototypeClass:KBImageTextView.class rowHeight:0];
  _deviceSignerView.scrollView.borderType = NSBezelBorder;

  _deviceSignerView.cellSetBlock = ^(KBImageTextView *view, KBDeviceSignerOption *option, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    view.tintImageForStyle = YES;
    [view setTitle:option.title info:option.info imageURLString:option.imageURLString imageSize:CGSizeMake(30, 30)];
  };
  [contentView addSubview:_deviceSignerView];

  YOView *bottomView = [[YOView alloc] init];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [bottomView addSubview:_cancelButton];
  _selectButton = [KBButton buttonWithText:@"Select" style:KBButtonStylePrimary];
  [bottomView addSubview:_selectButton];
  [contentView addSubview:bottomView];
  bottomView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts layoutForButton:_selectButton cancelButton:_cancelButton horizontalAlignment:KBHorizontalAlignmentCenter]];

  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_deviceSignerView topView:topView bottomView:bottomView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(600, 450)]];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
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
