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
#import "KBDeviceAddView.h"

@interface KBDevicesAppView ()
@property KBSplitView *splitView;
@property KBListView *devicesView;
@end

@implementation KBDevicesAppView

- (void)viewInit {
  [super viewInit];

  _splitView = [[KBSplitView alloc] init];
  [self addSubview:_splitView];

  YOSelf yself = self;

  YOView *devicesView = [[YOView alloc] init];
  NSImage *deviceAddImage = [NSImage imageNamed:@"19-Interface-black-add-1-24"];
  deviceAddImage.size = CGSizeMake(16, 16);
  KBButton *addButton = [KBButton buttonWithImage:deviceAddImage style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  addButton.targetBlock = ^{
    [yself addDevice];
  };
  [devicesView addSubview:addButton];

  _devicesView = [KBListView listViewWithPrototypeClass:KBDeviceCell.class rowHeight:56];
  _devicesView.cellSetBlock = ^(KBDeviceView *view, KBRDevice *device, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
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

  [_splitView setLeftView:devicesView];
  [_splitView setRightView:contentView];

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

- (void)removeDevice:(id)sender {
  NSIndexPath *indexPathToRemove = _devicesView.menuIndexPath;
  if (!indexPathToRemove) return;

  KBRDevice *device = [_devicesView.dataSource objectAtIndexPath:indexPathToRemove];
  if (!device) return;

  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  GHWeakSelf gself = self;
  [request revokeDeviceWithSessionID:request.sessionId idKb:device.deviceID completion:^(NSError *error) {
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    [gself.devicesView.dataSource removeObjectAtIndexPath:indexPathToRemove];
    [gself.devicesView reloadData];
  }];
}

- (void)addDevice {
  KBDeviceAddView *view = [[KBDeviceAddView alloc] init];
  view.client = self.client;
  dispatch_block_t close = [AppDelegate openSheetWithView:view size:CGSizeMake(500, 400) sender:self closeButton:view.cancelButton];
  view.completion = ^(BOOL ok) {
    close();
  };
}

@end
