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
#import "KBSecretWordsInputView.h"

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
  deviceAddImage.size = CGSizeMake(14, 14);
  KBButton *addButton = [KBButton buttonWithImage:deviceAddImage style:KBButtonStyleToolbar];
  addButton.targetBlock = ^{
    [yself addDevice];
  };
  [devicesView addSubview:addButton];

  _devicesView = [KBListView listViewWithPrototypeClass:KBDeviceView.class rowHeight:56];
  _devicesView.cellSetBlock = ^(KBDeviceView *view, KBRDevice *device, NSIndexPath *indexPath, NSTableColumn *tableColumn, NSTableView *tableView, BOOL dequeued) {
    [view setDevice:device];
  };
  _devicesView.selectBlock = ^(id sender, NSIndexPath *indexPath, KBRUser *user) {
    //[yself.userProfileView setUser:user editable:NO client:AppDelegate.client];
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
  contentView.wantsLayer = YES;
  contentView.layer.backgroundColor = NSColor.whiteColor.CGColor;

  [_splitView setSourceView:devicesView contentView:contentView];

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

- (void)addDevice {
  KBSecretWordsInputView *view = [[KBSecretWordsInputView alloc] init];
  view.client = self.client;
  KBButton *closeButton = view.cancelButton;
  [AppDelegate openSheetWithView:view size:CGSizeMake(500, 400) sender:self closeButton:closeButton];

  view.completion = ^(NSString *secretWords) {
    if (!secretWords) {
      closeButton.targetBlock();
      return;
    }
    AppDelegate.appView.progressEnabled = YES;
    KBRSibkeyRequest *request = [[KBRSibkeyRequest alloc] initWithClient:self.client];
    [request addWithSecretPhrase:secretWords completion:^(NSError *error) {
      AppDelegate.appView.progressEnabled = NO;
      if (error) {
        [AppDelegate setError:error sender:self];
        return;
      }
      closeButton.targetBlock();
    }];
  };
}

@end
