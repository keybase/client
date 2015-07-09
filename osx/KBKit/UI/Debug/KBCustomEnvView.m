//
//  KBCustomEnvView.m
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCustomEnvView.h"

#import "KBDefines.h"

@interface KBCustomEnvView ()
@property KBTextField *homeDirField;
@property KBTextField *socketFileField;
@property KBTextField *mountDirField;
@property KBLabel *serviceCLI;
@property KBLabel *kbfsCLI;
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

//  KBLabel *sockFileLabel = [KBLabel labelWithText:@"Socket File" style:KBTextStyleDefault];
//  [self addSubview:sockFileLabel];
//  _socketFileField = [[KBTextField alloc] init];
//  _socketFileField.textField.font = KBAppearance.currentAppearance.textFont;
//  _socketFileField.insets = UIEdgeInsetsMake(8, 8, 8, 0);
//  _socketFileField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
//  _socketFileField.onChange = ^{ [gself update]; };
//  [self addSubview:_socketFileField];

  KBLabel *mountDirLabel = [KBLabel labelWithText:@"Mount Dir" style:KBTextStyleDefault];
  [self addSubview:mountDirLabel];
  _mountDirField = [[KBTextField alloc] init];
  _mountDirField.textField.font = KBAppearance.currentAppearance.textFont;
  _mountDirField.insets = UIEdgeInsetsMake(8, 8, 8, 0);
  _mountDirField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _mountDirField.onChange = ^{ [gself update]; };
  [self addSubview:_mountDirField];

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
//    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, 9, col, 0) view:sockFileLabel].size.width + 10;
//    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, 0, size.width - x - 10, 0) view:yself.socketFileField].size.height + 10;
//    x = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:homeDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.homeDirField].size.height + 10;
    x = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:mountDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.mountDirField].size.height + 10;
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
//  NSString *sockFile = [_socketFileField.text gh_strip];
  NSString *mountDir = [_mountDirField.text gh_strip];
  return [[KBEnvConfig alloc] initWithHomeDir:homeDir sockFile:nil mountDir:mountDir];
}

- (void)setConfig:(KBEnvConfig *)config {
  _homeDirField.text = KBPath(config.homeDir, YES, NO);
//  _socketFileField.text = KBPath(config.sockFile, YES, NO);
  _mountDirField.text = KBPath(config.mountDir, YES, NO);
  [self updateCLI:config];
  [self setNeedsLayout];
}

- (void)updateCLI:(KBEnvConfig *)config {
  NSString *serviceCLI = NSStringWithFormat(@"env -i %@", [config commandLineForService:NO escape:YES tilde:YES options:@[@"service"]]);
  NSString *kbfsCLI = NSStringWithFormat(@"env -i %@", [config commandLineForKBFS:NO escape:YES tilde:YES options:nil]);

  [_serviceCLI setText:serviceCLI style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [_kbfsCLI setText:kbfsCLI style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [self setNeedsLayout];
}

@end
