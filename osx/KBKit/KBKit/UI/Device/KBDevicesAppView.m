//
//  KBDeviceAppView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDevicesAppView.h"

#import "KBDeviceView.h"
#import "KBDeviceAddView.h"

#import <MDPSplitView/MDPSplitView.h>
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBDevicesAppView ()
@property MDPSplitView *splitView;
@property KBListView *devicesView;

@property KBDeviceAddView *addView;
@end

@implementation KBDevicesAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[MDPSplitView alloc] init];
  [self addSubview:_splitView];

  YOSelf yself = self;

  YOView *devicesView = [[YOView alloc] init];
  KBButton *addButton = [KBFontIcon buttonForIcon:@"plus" text:nil style:KBButtonStyleDefault options:KBButtonOptionsToolbar sender:self];
  addButton.targetBlock = ^{
    [yself addDevice];
  };
  [devicesView addSubview:addButton];

  _devicesView = [KBListView listViewWithPrototypeClass:KBDeviceCell.class rowHeight:56];
  _devicesView.onSet = ^(KBDeviceView *view, KBRDevice *device, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [view setDevice:device];
  };
  _devicesView.onSelect = ^(id sender, KBTableSelection *selection) {

  };
  _devicesView.onMenuSelect = ^(KBTableView *tableView, NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Remove" action:@selector(removeDevice:) keyEquivalent:@""];
    return menu;
  };
  [devicesView addSubview:_devicesView];

  KBBox *line = [KBBox line];
  [devicesView addSubview:line];

  devicesView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 10;
    y += [layout setFrame:CGRectMake(10, y, 26, 26) view:addButton].size.height + 10;
    [layout setFrame:CGRectMake(0, y-1, size.width, 1) view:line];
    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.devicesView];
    return size;
  }];

  YOView *contentView = [[YOView alloc] init];
  [contentView kb_setBackgroundColor:NSColor.whiteColor];

  _splitView.vertical = YES;
  _splitView.dividerStyle = NSSplitViewDividerStyleThin;
  [_splitView addSubview:devicesView];
  [_splitView addSubview:contentView];
  [_splitView adjustSubviews];
  dispatch_async(dispatch_get_main_queue(), ^{
    [yself.splitView setPosition:240 ofDividerAtIndex:0 animated:NO];
  });

  self.viewLayout = [YOLayout fill:_splitView];
}

- (void)refresh {
  KBRDeviceRequest *request = [[KBRDeviceRequest alloc] initWithClient:_client];
  GHWeakSelf gself = self;
  // TODO animating?
  //_devicesView.progressView.animating = YES;
  [request deviceList:^(NSError *error, NSArray *items) {
    //gself.devicesView.progressView.animating = NO;
    if (error) {
      [gself.devicesView removeAllObjects];
      [KBActivity setError:error sender:self];
      return;
    }
    [gself.devicesView setObjects:items];
  }];
}

- (void)removeDevice:(id)sender {
  NSIndexPath *indexPathToRemove = _devicesView.menuIndexPath;
  if (!indexPathToRemove) return;

  KBRDevice *device = [_devicesView.dataSource objectAtIndexPath:indexPathToRemove];
  if (!device) return;

  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  GHWeakSelf gself = self;
  KBRRevokeDeviceRequestParams *params = [KBRRevokeDeviceRequestParams params];
  params.deviceID = device.deviceID;
  [request revokeDevice:params completion:^(NSError *error) {
    if ([KBActivity setError:error sender:self]) return;

    [gself.devicesView.dataSource removeObjectAtIndexPath:indexPathToRemove];
    [gself.devicesView reloadData];
  }];
}

- (void)addDevice {
  if (_addView) {
    [_addView.window close];
    _addView = nil;
  }

  _addView = [[KBDeviceAddView alloc] init];
  _addView.client = self.client;
  GHWeakSelf gself = self;
  _addView.completion = ^(id sender, BOOL added) {
    [gself refresh];
  };
  [_addView openInWindow:(KBWindow *)self.window];
}

@end
