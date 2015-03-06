//
//  KBDeviceSetupView.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceSetupView.h"

#import "KBRPC.h"
#import "KBDeviceSignerOption.h"

@interface KBDeviceSetupView ()
@end

@implementation KBDeviceSetupView

- (void)viewInit {
  [super viewInit];

  YONSView *topView = [[YONSView alloc] init];
  [self.contentView addSubview:topView];
  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Device Setup" style:KBLabelStyleHeader appearance:KBAppearance.currentAppearance alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [topView addSubview:header];

  KBLabel *infoLabel = [[KBLabel alloc] init];
  [infoLabel setText:@"This is the first time you've logged into this computer. You need to setup and verify this installation of Keybase. Which method do you want to use?" font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSCenterTextAlignment];
  [topView addSubview:infoLabel];
  topView.viewLayout = [YOLayout vertical:topView.subviews margin:UIEdgeInsetsZero padding:20];

  _deviceSignerView = [KBListView listViewWithPrototypeClass:KBImageTextView.class rowHeight:0];
  _deviceSignerView.layer.borderColor = [KBAppearance.currentAppearance lineColor].CGColor;
  _deviceSignerView.layer.borderWidth = 1.0;

  _deviceSignerView.cellSetBlock = ^(KBImageTextView *view, KBDeviceSignerOption *option, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    view.tintImageForStyle = YES;
    [view setTitle:option.title info:option.info imageSource:option.imageSource];
  };
  [self.contentView addSubview:_deviceSignerView];

  YONSView *bottomView = [[YONSView alloc] init];
  _selectButton = [KBButton buttonWithText:@"Select" style:KBButtonStylePrimary];
  [bottomView addSubview:_selectButton];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [bottomView addSubview:_cancelButton];
  [self.contentView addSubview:bottomView];

  YOSelf yself = self;
  bottomView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(size.width - 280, 0, 130, 0) view:yself.selectButton].size.height;
    [layout sizeToFitVerticalInFrame:CGRectMake(size.width - 130, 0, 130, 0) view:yself.cancelButton];
    return CGSizeMake(size.width, y);
  }];

  self.contentView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_deviceSignerView topView:topView bottomView:bottomView margin:UIEdgeInsetsMake(20, 20, 20, 20) padding:20 maxSize:CGSizeMake(600, 450)]];
}

- (void)setDevices:(NSArray *)devices hasPGP:(BOOL)hasPGP {
  NSMutableArray *deviceSignerOptions = [NSMutableArray array];
  for (KBRDevice *device in devices) {
    [deviceSignerOptions addObject:[KBDeviceSignerOption deviceWithIdentifier:device.deviceID name:device.name]];
  }
  if (hasPGP) [deviceSignerOptions addObject:[KBDeviceSignerOption PGP]];

  [_deviceSignerView setObjects:deviceSignerOptions];
}

@end
