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
@property KBSplitView *splitView;

@property KBTextField *homeDirField; // For custom envs
@property KBTextField *socketFileField; // For custom envs
@end

@implementation KBEnvSelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Choose an Environment" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self addSubview:header];

  _splitView = [[KBSplitView alloc] init];
  _splitView.dividerPosition = 300;
  _splitView.divider.hidden = YES;
  _splitView.rightInsets = UIEdgeInsetsMake(0, 20, 0, 0);
  [self addSubview:_splitView];

  KBListView *listView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:0];
  listView.scrollView.borderType = NSBezelBorder;
  listView.cellSetBlock = ^(KBImageTextView *label, KBEnvironment *env, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:env.title info:env.info image:env.image];
  };
  listView.onSelect = ^(KBTableView *tableView, NSIndexPath *indexPath, KBEnvironment *environment) {
    [self select:environment];
  };
  [_splitView setLeftView:listView];

  GHWeakSelf gself = self;
  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [self addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Next" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{
    KBEnvironment *env = listView.selectedObject;
    if ([env.identifier isEqualToString:@"custom"]) {
      [self selectWithHomeDir:gself.homeDirField.text sockFile:gself.socketFileField.text];
    } else {
      self.onSelect(env);
    }
  };
  [buttons addSubview:nextButton];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_splitView top:@[header] bottom:@[buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];

  NSString *homeDir = [NSUserDefaults.standardUserDefaults stringForKey:@"HomeDir"];
  if (!homeDir) homeDir = KBPath(@"~/Projects/Keybase", NO);

  NSString *sockFile = [NSUserDefaults.standardUserDefaults stringForKey:@"SockFile"];
  if (!sockFile) sockFile = KBPath([KBEnvironment defaultSockFileForHomeDir:homeDir], NO);

  KBEnvironment *custom = [[KBEnvironment alloc] initWithHomeDir:homeDir sockFile:sockFile];

  [listView setObjects:@[[KBEnvironment env:KBEnvKeybaseIO], [KBEnvironment env:KBEnvLocalhost], custom] animated:NO];
  [listView setSelectedRow:2];
}

- (void)selectWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile {
  homeDir = [homeDir gh_strip];
  sockFile = [sockFile gh_strip];
  [NSUserDefaults.standardUserDefaults setObject:homeDir forKey:@"HomeDir"];
  [NSUserDefaults.standardUserDefaults synchronize];
  [NSUserDefaults.standardUserDefaults setObject:sockFile forKey:@"SockFile"];
  [NSUserDefaults.standardUserDefaults synchronize];

  if (![NSFileManager.defaultManager fileExistsAtPath:KBPath(homeDir, NO) isDirectory:nil]) {
    [KBActivity setError:KBMakeError(-1, @"%@ doesn't exist", homeDir) sender:self];
    return;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:KBPath(sockFile, NO) isDirectory:nil]) {
    [KBActivity setError:KBMakeError(-1, @"%@ doesn't exist", sockFile) sender:self];
    return;
  }

  KBEnvironment *custom = [[KBEnvironment alloc] initWithHomeDir:homeDir sockFile:sockFile];
  self.onSelect(custom);
}

- (void)select:(KBEnvironment *)environment {
  [_splitView setRightView:[self viewForEnvironment:environment]];
}

- (NSView *)customView:(KBEnvironment *)environment {
  YOView *view = [YOView view];
  KBLabel *homeDirLabel = [KBLabel labelWithText:@"Home" style:KBTextStyleDefault];
  [view addSubview:homeDirLabel];
  _homeDirField = [[KBTextField alloc] init];
  _homeDirField.textField.font = KBAppearance.currentAppearance.textFont;
  _homeDirField.insets = UIEdgeInsetsMake(8, 8, 8, 0);
  _homeDirField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _homeDirField.text = KBPath(environment.homeDir, YES);
  [view addSubview:_homeDirField];
  KBLabel *sockFileLabel = [KBLabel labelWithText:@"Socket File" style:KBTextStyleDefault];
  [view addSubview:sockFileLabel];
  _socketFileField = [[KBTextField alloc] init];
  _socketFileField.textField.font = KBAppearance.currentAppearance.textFont;
  _socketFileField.insets = UIEdgeInsetsMake(8, 8, 8, 0);
  _socketFileField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _socketFileField.text = KBPath(environment.sockFile, YES);
  [view addSubview:_socketFileField];
  YOSelf yself = self;
  view.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    CGFloat col = 80;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, 9, col, 0) view:sockFileLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, 0, size.width - x - 10, 0) view:yself.socketFileField].size.height + 10;
    x = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:homeDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.homeDirField].size.height + 10;

    return size;
  }];
  return view;
}

- (NSView *)viewForEnvironment:(KBEnvironment *)environment {
  _socketFileField = nil;
  _homeDirField = nil;
  if ([environment.identifier isEqual:@"custom"]) return [self customView:environment];

  YOVBox *view = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];

  typedef NSView * (^KBCreateEnvInfoLabel)(NSString *key, NSString *value);

  KBCreateEnvInfoLabel createView = ^NSView *(NSString *key, NSString *value) {
    KBHeaderLabelView *view = [KBHeaderLabelView headerLabelViewWithHeader:key headerOptions:KBTextOptionsMonospace text:value style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByCharWrapping];
    view.columnWidth = 80;
    return view;
  };

  [view addSubview:createView(@"Id", environment.identifier)];
  [view addSubview:createView(@"Home", KBPath(environment.homeDir, YES))];
  if (environment.host) [view addSubview:createView(@"Host", environment.host)];
  if (environment.mountDir) [view addSubview:createView(@"Mount", KBPath(environment.mountDir, YES))];
  if (environment.isLaunchdEnabled) {
    [view addSubview:createView(@"Service", environment.launchdLabelService)];
    [view addSubview:createView(@"KBFS", environment.launchdLabelKBFS)];
  }

  if (!environment.isInstallEnabled) {
    [view addSubview:createView(@"Other", @"Installer Disabled")];
  }

  //[view addSubview:createView(@"Service", [environment commandLineForService:YES])];
  //[view addSubview:createView(@"KBFS", [environment commandLineForKBFS:YES])];

  [view kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  return view;
}

@end
