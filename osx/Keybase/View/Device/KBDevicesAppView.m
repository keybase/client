//
//  KBDeviceAppView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDevicesAppView.h"

#import "KBDeviceView.h"
#import "AppDelegate.h"

@interface KBDevicesAppView ()
@property KBSplitView *splitView;
@property KBListView *devicesView;
@end

@implementation KBDevicesAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[KBSplitView alloc] init];
  _splitView.insets = UIEdgeInsetsMake(24, 0, 0, 0);
  [self addSubview:_splitView];

  _devicesView = [KBListView listViewWithPrototypeClass:KBDeviceView.class rowHeight:56];
  _devicesView.cellSetBlock = ^(KBDeviceView *view, KBRDevice *device, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
    [view setDevice:device];
  };
  _devicesView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUser *user) {
    //[yself.userProfileView setUser:user editable:NO client:AppDelegate.client];
  };

  YONSView *contentView = [[YONSView alloc] init];
  contentView.wantsLayer = YES;
  contentView.layer.backgroundColor = NSColor.whiteColor.CGColor;

  [_splitView setSourceView:_devicesView contentView:contentView];

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)refresh {
  KBRDeviceRequest *request = [[KBRDeviceRequest alloc] initWithClient:_client];
  GHWeakSelf gself = self;
  [request deviceListWithSessionID:request.sessionId completion:^(NSError *error, NSArray *items) {
    if (error) {
      [gself.devicesView removeAllObjects];
      [AppDelegate setError:error sender:self];
      return;
    }
    [gself.devicesView setObjects:items];
  }];
}

@end
