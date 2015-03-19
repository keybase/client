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
  [self addSubview:_splitView];

  _devicesView = [KBListView listViewWithPrototypeClass:KBDeviceView.class rowHeight:56];
  _devicesView.cellSetBlock = ^(KBDeviceView *view, KBRDevice *device, NSIndexPath *indexPath, NSTableColumn *tableColumn, NSTableView *tableView, BOOL dequeued) {
    [view setDevice:device];
  };
  _devicesView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUser *user) {
    //[yself.userProfileView setUser:user editable:NO client:AppDelegate.client];
  };

  YOView *contentView = [[YOView alloc] init];
  contentView.wantsLayer = YES;
  contentView.layer.backgroundColor = NSColor.whiteColor.CGColor;

  [_splitView setSourceView:_devicesView contentView:contentView];

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)reload {
  KBRDeviceRequest *request = [[KBRDeviceRequest alloc] initWithClient:_client];
  GHWeakSelf gself = self;
  _devicesView.progressView.animating = YES;
  [request deviceListWithSessionID:request.sessionId completion:^(NSError *error, NSArray *items) {
    gself.devicesView.progressView.animating = NO;
    if (error) {
      [gself.devicesView removeAllObjects];
      [AppDelegate setError:error sender:self];
      return;
    }
    [gself.devicesView setObjects:items];
  }];
}

@end
