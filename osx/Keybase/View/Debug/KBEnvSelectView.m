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
#import "KBHeaderLabelView.h"

@interface KBEnvSelectView ()
@property YOView *envView;
@end

@implementation KBEnvSelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Choose an Environment" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self addSubview:header];

  KBListView *listView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:56];
  listView.scrollView.borderType = NSBezelBorder;
  listView.cellSetBlock = ^(KBImageTextView *label, KBEnvironment *env, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:env.title info:env.info image:env.image];
  };
  listView.onSelect = ^(KBTableView *tableView, NSIndexPath *indexPath, KBEnvironment *environment) {
    [self select:environment];
  };
  [self addSubview:listView];

  _envView = [YOVBox box:@{@"minSize":@"0,200"}];
  [self addSubview:_envView];

  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [self addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Next" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{
    self.onSelect(listView.selectedObject);
  };
  [buttons addSubview:nextButton];

  self.viewLayout = [YOBorderLayout layoutWithCenter:listView top:@[header] bottom:@[_envView, buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];

  [listView setObjects:@[[KBEnvironment env:KBEnvKeybaseIO], [KBEnvironment env:KBEnvLocalhost], [KBEnvironment env:KBEnvManual]] animated:NO];
  [listView setSelectedRow:2];
}

- (void)select:(KBEnvironment *)environment {
  for (NSView *view in _envView.subviews) [view removeFromSuperview];
  if (environment) {
    [_envView addSubview:[self viewForEnvironment:environment]];
  }
  [_envView setNeedsLayout];

  //DDLogDebug(@"Service plist: %@", environment.launchdPlistDictionaryForService);
  //DDLogDebug(@"KBFS plist: %@", environment.launchdPlistDictionaryForKBFS);
}

- (NSView *)viewForEnvironment:(KBEnvironment *)environment {
  YOVBox *view = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];

  typedef NSView * (^KBCreateEnvInfoLabel)(NSString *key, NSString *value);

  KBCreateEnvInfoLabel createView = ^NSView *(NSString *key, NSString *value) {
    KBHeaderLabelView *view = [KBHeaderLabelView headerLabelViewWithHeader:key headerOptions:KBTextOptionsMonospace text:value style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByCharWrapping];
    view.columnWidth = 80;
    return view;
  };

  [view addSubview:createView(@"Id", environment.identifier)];
  [view addSubview:createView(@"Home", KBDir(environment.homeDir, YES))];
  [view addSubview:createView(@"Host", environment.host)];
  //[view addSubview:createView(@"Sock", KBDir(environment.sockFile, YES))];
  [view addSubview:createView(@"Mount", KBDir(environment.mountDir, YES))];
  if (environment.isLaunchdEnabled) {
    [view addSubview:createView(@"Service", environment.launchdLabelService)];
    [view addSubview:createView(@"KBFS", environment.launchdLabelKBFS)];
  }

  if (environment.isInstallEnabled) {
    [view addSubview:createView(@"Other", @"Installer Disabled")];
  }

  //[view addSubview:createView(@"Service", [environment commandLineForService:YES])];
  //[view addSubview:createView(@"KBFS", [environment commandLineForKBFS:YES])];

  [view kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  return view;
}

@end
