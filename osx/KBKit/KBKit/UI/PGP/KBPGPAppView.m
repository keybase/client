//
//  KBPGPAppView.m
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPAppView.h"

#import "KBPGPEncryptAppView.h"
#import "KBPGPDecryptAppView.h"
#import "KBPGPSignAppView.h"
#import "KBPGPVerifyAppView.h"
#import "KBViews.h"

@interface KBPGPAppView ()
@property KBViews *views;
@property KBPGPEncryptAppView *encryptView;
@property KBPGPDecryptAppView *decryptView;
@property KBPGPSignAppView *signView;
@property KBPGPVerifyAppView *verifyView;

//@property NSPopUpButton *signOptions;
@end

@implementation KBPGPAppView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  NSSegmentedControl *picker = [[NSSegmentedControl alloc] init];
  [[picker cell] setControlSize:NSRegularControlSize];

  [picker setSegmentCount:4];
  [picker setLabel:@"Encrypt" forSegment:0];
  [picker setLabel:@"Decrypt" forSegment:1];
  [picker setLabel:@"Sign" forSegment:2];
  [picker setLabel:@"Verify" forSegment:3];
  picker.target = self;
  picker.action = @selector(pickerSelected:);
  [self addSubview:picker];

  _encryptView = [[KBPGPEncryptAppView alloc] init];
  KBNavigationView *encryptView = [[KBNavigationView alloc] initWithView:_encryptView];
  encryptView.identifier = @"Encrypt";
  [encryptView setBorderEnabled:YES];

  _decryptView = [[KBPGPDecryptAppView alloc] init];
  KBNavigationView *decryptView = [[KBNavigationView alloc] initWithView:_decryptView];
  decryptView.identifier = @"Decrypt";
  [decryptView setBorderEnabled:YES];

  _signView = [[KBPGPSignAppView alloc] init];
  KBNavigationView *signView = [[KBNavigationView alloc] initWithView:_signView];
  signView.identifier = @"Sign";
  [signView setBorderEnabled:YES];

  _verifyView = [[KBPGPVerifyAppView alloc] init];
  KBNavigationView *verifyView = [[KBNavigationView alloc] initWithView:_verifyView];
  verifyView.identifier = @"Verify";
  [verifyView setBorderEnabled:YES];


  KBBox *line = [KBBox horizontalLine];
  [self addSubview:line];

  _views = [[KBViews alloc] init];
  [self addSubview:_views];

  [_views setViews:@[encryptView, decryptView, signView, verifyView]];

  picker.selectedSegment = 0;
  [self pickerSelected:picker];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 8;

    y += [layout centerWithSize:CGSizeMake(300, 24) frame:CGRectMake(0, y, size.width, 24) view:picker].size.height + 7;

    [layout setFrame:CGRectMake(0, y, size.width, 1) view:line];

    //[layout setFrame:CGRectMake(0, y, MIN(size.width, 500), size.height - y + 1) view:yself.views];
    [layout centerWithSize:CGSizeMake(MIN(size.width, 500), size.height - y + 1) frame:CGRectMake(0, y, size.width, size.height - y + 1) view:yself.views];

    return size;
  }];
}

- (void)pickerSelected:(id)sender {
  NSInteger clickedSegment = [sender selectedSegment];
  NSString *label = [[sender cell] labelForSegment:clickedSegment];
  [_views showViewWithIdentifier:label];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _encryptView.client = client;
  _decryptView.client = client;
  _signView.client = client;
  _verifyView.client = client;
}

@end
