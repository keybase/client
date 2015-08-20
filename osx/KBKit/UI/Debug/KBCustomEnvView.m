//
//  KBCustomEnvView.m
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCustomEnvView.h"

#import "KBDefines.h"
#import "KBPath.h"

#import "KBService.h"
#import "KBFSService.h"

@interface KBCustomEnvView ()
@property KBTextField *homeDirField;
@property KBTextField *socketFileField;
@property KBTextField *mountDirField;
@property KBLabel *serviceCLI;
@property KBLabel *kbfsCLI;
//@property KBButton *develButton;
@end

@implementation KBCustomEnvView

- (void)viewInit {
  GHWeakSelf gself = self;
  KBLabel *homeDirLabel = [KBLabel labelWithText:@"Home" style:KBTextStyleDefault];
  [self addSubview:homeDirLabel];
  _homeDirField = [[KBTextField alloc] init];
  _homeDirField.textField.font = KBAppearance.currentAppearance.textFont;
  _homeDirField.insets = UIEdgeInsetsMake(8, 8, 8, 0);
  _homeDirField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _homeDirField.onChange = ^{ [gself update]; };
  [self addSubview:_homeDirField];

  KBLabel *mountDirLabel = [KBLabel labelWithText:@"Mount Dir" style:KBTextStyleDefault];
  [self addSubview:mountDirLabel];
  _mountDirField = [[KBTextField alloc] init];
  _mountDirField.textField.font = KBAppearance.currentAppearance.textFont;
  _mountDirField.insets = UIEdgeInsetsMake(8, 8, 8, 0);
  _mountDirField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _mountDirField.onChange = ^{ [gself update]; };
  [self addSubview:_mountDirField];

//  _develButton = [KBButton buttonWithText:@"Dev Mode (Localhost)" style:KBButtonStyleCheckbox];
//  _develButton.state = NSOnState;
//  [self addSubview:_develButton];

  KBLabel *serviceLabel = [KBLabel labelWithText:@"Service Command" style:KBTextStyleHeader];
  [self addSubview:serviceLabel];
  _serviceCLI = [KBLabel label];
  _serviceCLI.selectable = YES;
  [self addSubview:_serviceCLI];

  KBLabel *kbfsLabel = [KBLabel labelWithText:@"KBFS Command" style:KBTextStyleHeader];
  [self addSubview:kbfsLabel];
  _kbfsCLI = [KBLabel label];
  _kbfsCLI.selectable = YES;
  [self addSubview:_kbfsCLI];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    CGFloat col = 80;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:homeDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.homeDirField].size.height + 10;
    x = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:mountDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.mountDirField].size.height + 10;
//    y += [layout sizeToFitInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.develButton].size.height + 10;
    x = 0;
    y += 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:serviceLabel].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.serviceCLI].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:kbfsLabel].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.kbfsCLI].size.height + 10;

    return size;
  }];
}

- (void)update {
  [self updateCLI:[self config]];
}

- (KBEnvConfig *)config {
  NSString *homeDir = [_homeDirField.text gh_strip];
  NSString *mountDir = [_mountDirField.text gh_strip];
  return [KBEnvConfig customEnvWithHomeDir:homeDir sockFile:nil mountDir:mountDir];
}

- (void)setConfig:(KBEnvConfig *)config {
  _homeDirField.text = [KBPath path:config.homeDir options:KBPathOptionsTilde];
  _mountDirField.text = [KBPath path:config.mountDir options:KBPathOptionsTilde];
  [self updateCLI:config];
  [self setNeedsLayout];
}

- (void)updateCLI:(KBEnvConfig *)config {
  NSString *serviceCLI = NSStringWithFormat(@"env -i %@", [KBService commandLineForService:config useBundle:NO pathOptions:KBPathOptionsEscape args:@[@"service"]]);
  NSString *kbfsCLI = NSStringWithFormat(@"env -i %@", [KBFSService commandLineForKBFS:config useBundle:NO pathOptions:KBPathOptionsEscape args:nil]);

  [_serviceCLI setText:serviceCLI style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [_kbfsCLI setText:kbfsCLI style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [self setNeedsLayout];
}

@end
