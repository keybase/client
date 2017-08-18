//
//  KBPGPEncryptActionView.m
//  Keybase
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBPGPEncryptActionView.h"

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
#import "KBPGPTextView.h"
#import "KBWorkspace.h"
#import "KBService.h"
#import "KBComposeTextView.h"

@interface KBPGPEncryptActionView () <KBUserPickerViewDelegate>
@property KBUserPickerView *userPickerView;
@property KBPGPEncryptToolbarFooterView *footerView;
@property KBPGPEncrypt *encrypter;

@property KBComposeTextView *textView;
@property KBFileIcon *fileIcon;

@property YOVBorderLayout *borderLayout;
@end

@implementation KBPGPEncryptActionView

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

  _footerView = [[KBPGPEncryptToolbarFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  _footerView.cancelButton.targetBlock = ^{
    gself.completion(gself, nil);
  };
  [self addSubview:_footerView];

  _textView = [[KBComposeTextView alloc] init];

  _fileIcon = [[KBFileIcon alloc] init];
  _fileIcon.iconHeight = 400;
  _fileIcon.font = [NSFont systemFontOfSize:18];

  _borderLayout = [YOVBorderLayout layoutWithCenter:nil top:@[topView] bottom:@[_footerView]];
  self.viewLayout = _borderLayout;
}

- (void)layout {
  [super layout];
  NSView *centerView = _borderLayout.center;
  [_userPickerView setSearchResultsFrame:CGRectMake(0, 1, centerView.bounds.size.width, centerView.bounds.size.height) inView:self];
}

- (void)setClient:(KBRPClient *)client {
  _client = client;
  _userPickerView.client = client;
}

- (void)setExtensionItem:(NSExtensionItem *)extensionItem {
  _extensionItem = extensionItem;
  NSString *text = _extensionItem.attributedContentText.string;
  if (text) {
    [_fileIcon removeFromSuperview];
    _borderLayout.center = _textView;
    [self addSubview:_textView];
    _textView.text = text;
  } else {
    [_textView removeFromSuperview];
    _borderLayout.center = _fileIcon;
    [self addSubview:_fileIcon];
    _fileIcon.file = [KBFile fileFromExtensionItem:extensionItem];
  }
  [self setNeedsLayout];
}

- (void)encrypt {
  id<KBReader> reader;
  id<KBWriter> writer;
  KBRPGPEncryptOptions *options = [[KBRPGPEncryptOptions alloc] init];
  if ([_textView superview]) {
    reader = [KBReader readerWithData:[_textView.text dataUsingEncoding:NSUTF8StringEncoding]];
    writer = [KBWriter writer];
  } else if ([_fileIcon superview]) {
    options.binaryOut = YES;
    NSString *path = _fileIcon.file.path;
    reader = [KBFileReader fileReaderWithPath:path];
    NSString *outPath = [path stringByAppendingPathExtension:@"gpg"];
    writer = [KBFileWriter fileWriterWithPath:outPath];
  }

  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];

  options.recipients = _userPickerView.usernames;

  [KBActivity setProgressEnabled:YES sender:self];
  //GHWeakSelf gself = self;
  _encrypter = [[KBPGPEncrypt alloc] init];
  [_encrypter encryptWithOptions:options streams:@[stream] client:self.client sender:self completion:^(NSArray *works) {
    KBWork *work = works[0];
    NSError *error = [work error];
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    KBStream *stream = [work output];
    if (stream.writer.data) {
      NSExtensionItem *outputItem = [[NSExtensionItem alloc] init];
      if (!options.binaryOut) {
        NSString *string = [[NSString alloc] initWithData:stream.writer.data encoding:NSUTF8StringEncoding];
        outputItem.attributedContentText = [[NSAttributedString alloc] initWithString:string];
      }
      self.completion(self, outputItem);
    }
  }];
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {

}

- (void)userPickerView:(KBUserPickerView *)userPickerView didUpdateSearch:(BOOL)visible {
  [_textView setEnabled:!visible];
}

@end