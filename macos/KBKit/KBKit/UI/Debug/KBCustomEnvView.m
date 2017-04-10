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

@interface KBCustomEnvView ()
@property KBTextField *homeDirField;
@property KBTextField *socketFileField;
@property KBTextField *mountDirField;
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

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 0;
    CGFloat col = 80;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:homeDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.homeDirField].size.height + 10;
    x = 10;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 9, col, 0) view:mountDirLabel].size.width + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.mountDirField].size.height + 10;
    x = 10;
    y += 20;

    return size;
  }];
}

- (void)update {

}

- (KBEnvConfig *)config {
  NSString *homeDir = [_homeDirField.text gh_strip];
  NSString *mountDir = [_mountDirField.text gh_strip];
  return [KBEnvConfig envConfigWithHomeDir:homeDir mountDir:mountDir runMode:KBRunModeDevel];
}

- (void)setConfig:(KBEnvConfig *)config {
  _homeDirField.text = [KBPath path:config.homeDir options:KBPathOptionsTilde];
  _mountDirField.text = [KBPath path:config.mountDir options:KBPathOptionsTilde];
  [self setNeedsLayout];
}

@end
