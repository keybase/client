//
//  KBKeyGenView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyGenView.h"
#import "AppDelegate.h"
#import "KBUIDefines.h"
#import "KBRPC.h"

@interface KBKeyGenView ()
@property KBTextLabel*titleLabel;
@property KBTextLabel *infoLabel;
@property KBButton *button;
@property KBButton *selectButton;
@end

@implementation KBKeyGenView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _titleLabel = [[KBTextLabel alloc] init];
  _titleLabel.text = @"Keybase";
  _titleLabel.textAlignment = NSCenterTextAlignment;
  _titleLabel.font = [NSFont fontWithName:@"Helvetica Neue Thin" size:48];
  [self addSubview:_titleLabel];

  _infoLabel = [[KBTextLabel alloc] init];
  _infoLabel.text = @"Welcome to keybase.io! You now need to associate a key with your account.";
  _infoLabel.textAlignment = NSCenterTextAlignment;
  [self addSubview:_infoLabel];

  _button = [[KBButton alloc] init];
  _button.text = @"Create Key";
  [self addSubview:_button];

  _selectButton = [KBButton buttonAsLinkWithText:@"I have a key already, let me select it."];
  [self addSubview:_selectButton];

  [AppDelegate.client registerMethod:@"keybase.1.mykeyUi.getPushPreferences" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBPushPreferences *preferences = [[KBPushPreferences alloc] init];
    preferences.public = YES;
    completion(nil, [MTLJSONAdapter JSONDictionaryFromModel:preferences]);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.secretUi.getNewPassphrase" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, @"");
  }];

  self.button.targetBlock = ^{
    [gself setInProgress:YES sender:nil];
    KBRMykey *mykey = [[KBRMykey alloc] initWithClient:AppDelegate.client];
    [mykey keyGenSimpleWithIds:@[] completion:^(NSError *error) {
      [gself setInProgress:NO sender:nil];
      if (error) {
        [[NSAlert alertWithError:error] beginSheetModalForWindow:gself.window completionHandler:nil];
        return;
      }
    }];
  };

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.titleLabel sizeToFit:YES].size.height + 20;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel sizeToFit:YES].size.height + 20;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.button].size.height + 30;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.selectButton].size.height + 30;

    return CGSizeMake(size.width, y);
  }];
}

@end
