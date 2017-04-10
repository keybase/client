//
//  KBPGPEncryptView.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptView.h"

#import "KBUserProfileView.h"
#import "KBReader.h"
#import "KBWriter.h"
#import "KBPGPOutputView.h"
#import "KBPGPEncrypt.h"
#import "KBRPC.h"
#import "KBPGPEncryptFooterView.h"
#import "KBFileIcon.h"
#import "KBFileReader.h"
#import "KBFileWriter.h"
#import "KBWork.h"
#import "KBUserPickerView.h"
#import "KBComposeTextView.h"

@interface KBPGPEncryptView () <KBUserPickerViewDelegate>
@property KBUserPickerView *userPickerView;
@property KBComposeTextView *textView;
@property KBPGPEncryptFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;
  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  [topView addSubview:_userPickerView];
  [topView addSubview:[KBBox horizontalLine]];

  _textView = [[KBComposeTextView alloc] init];
  _textView.onChange = ^(KBTextView *textView) {
    if (gself.onEncrypt) gself.onEncrypt(gself, nil);
  };
  [self addSubview:_textView];

  _userPickerView.nextKeyView = _textView.view;

  YOVBox *bottomView = [YOVBox box];
  [self addSubview:bottomView];

  _footerView = [[KBPGPEncryptFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  [bottomView addSubview:_footerView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:@[topView] bottom:@[bottomView]];
}

- (void)layout {
  [super layout];
  NSView *centerView = _textView;
  [_userPickerView setSearchResultsFrame:CGRectMake(0, 1, centerView.bounds.size.width, centerView.bounds.size.height) inView:self];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _userPickerView.client = client;
}

//- (void)mailShare {
//  NSSharingService *mailShare = [NSSharingService sharingServiceNamed:NSSharingServiceNameComposeEmail];
//  NSArray *shareItems = @[]; // @[textAttributedString, tempFileURL];
//  [mailShare performWithItems:shareItems];
//}

- (void)encrypt {
  NSString *text = _textView.text;

  KBReader *reader = [KBReader readerWithData:[text dataUsingEncoding:NSUTF8StringEncoding]];
  KBWriter *writer = [KBWriter writer];
  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];

  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPGPEncryptOptions *options = [[KBRPGPEncryptOptions alloc] init];
  options.recipients = _userPickerView.usernames;
  options.noSelf = _footerView.includeSelfButton.state != NSOnState;
  options.noSign = _footerView.signButton.state != NSOnState;
  options.binaryOut = NO;  
  [KBActivity setProgressEnabled:YES sender:self];
  //GHWeakSelf gself = self;
  [_encrypter encryptWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    KBWork *work = works[0];
    NSError *error = [work error];
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    
    KBStream *stream = [work output];
    
    if (stream.writer.data) {
      if (self.onEncrypt) {
        self.onEncrypt(self, stream.writer.data);
      } else {
        [self _encrypt:stream.writer.data];
      }
    }
  }];
}

- (void)_encrypt:(NSData *)data {
  KBPGPOutputView *outputView = [[KBPGPOutputView alloc] init];
  [outputView setData:data armored:YES];
  [self.navigation pushView:outputView animated:YES];
}

- (void)addUsername:(NSString *)username {
  [_userPickerView addUsername:username];
  [self setNeedsLayout];
}

- (void)setText:(NSString *)text {
  _textView.text = text;
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {
  CGSize size = userPickerView.frame.size;
  CGSize sizeThatFits = [userPickerView sizeThatFits:self.frame.size];
  if (sizeThatFits.height > size.height) {
    [self layoutView];
  }
}

// This will let the user picker group grow if someone adds a lot of users
- (void)userPickerView:(KBUserPickerView *)userPickerView didUpdateSearch:(BOOL)visible {
  [_textView setEnabled:!visible];
}

@end
