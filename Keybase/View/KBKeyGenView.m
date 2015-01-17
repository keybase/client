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
@property KBTextLabel *infoLabel;
@property KBButton *button;
@property KBButton *selectButton;
@end

@implementation KBKeyGenView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _infoLabel = [[KBTextLabel alloc] init];
  [_infoLabel setText:@"Welcome to keybase.io! You now need to associate a key with your account." font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  [self addSubview:_infoLabel];

  _button = [[KBButton alloc] init];
  _button.text = @"Create Key";
  self.button.targetBlock = ^{
    [gself generateKey];
  };
  [self addSubview:_button];

  _selectButton = [KBButton buttonAsLinkWithText:@"I have a key already, let me select it."];
  _selectButton.targetBlock = ^{
    KBTODO(gself);
  };
  [self addSubview:_selectButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height + 20;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.button].size.height + 30;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.selectButton].size.height + 30;

    return CGSizeMake(size.width, y);
  }];
}

- (void)generateKey {
  [AppDelegate passwordPrompt:@"Your key passphrase" description:@"We'll encrypt your secret key with this password." view:self completion:^(BOOL canceled, NSString *password) {
    [self _generateKey:password];
  }];
}

- (void)_generateKey:(NSString *)password {
  GHWeakSelf gself = self;

  NSString *username = AppDelegate.sharedDelegate.status.user.username;
  NSAssert(username, @"No username");

  KBPgpCreateUids *uids = [[KBPgpCreateUids alloc] init];
  uids.useDefault = YES;

  [self setInProgress:YES sender:nil];
  KBRMykey *mykey = [[KBRMykey alloc] initWithClient:AppDelegate.client];
  [mykey keyGenDefaultWithCreateUids:uids pushPublic:YES pushSecret:NO passphrase:password completion:^(NSError *error) {
    [gself setInProgress:NO sender:nil];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:gself.window completionHandler:nil];
      return;
    }

    [AppDelegate.sharedDelegate.windowController showTwitterConnect:YES];
  }];
}

@end
