//
//  KBPGPEncryptFileView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptFileView.h"
#import "KBPGPEncrypt.h"
#import "KBFileReader.h"
#import "KBFileWriter.h"
#import "KBPGPEncryptFooterView.h"
#import "KBFileSelectView.h"
#import "KBFileIcon.h"
#import "KBFileListView.h"
#import "KBPGPOutputFileView.h"

@interface KBPGPEncryptFileView ()
@property KBUserPickerView *userPickerView;
//@property YOBox *files;
@property KBFileListView *fileListView;
@property KBPGPEncryptFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@property NSMutableArray *outputFiles;
@end

@implementation KBPGPEncryptFileView

- (void)viewInit {
  [super viewInit];
  [self setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  [topView addSubview:_userPickerView];
  [topView addSubview:[KBBox horizontalLine]];

  YOSelf yself = self;
  YOView *contentView = [YOView view];
  [self addSubview:contentView];

  YOVBox *toolbarView = [YOVBox box];
  [toolbarView setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  [contentView addSubview:toolbarView];

  YOHBox *buttonsView = [YOHBox box:@{@"insets": @(10)}];
  [toolbarView addSubview:buttonsView];
  [toolbarView addSubview:[KBBox horizontalLine]];

  NSImage *attachmentImage = [NSImage imageNamed:@"1-Edition-black-clip-1-24"];
  attachmentImage.size = CGSizeMake(12, 12);
  KBButton *attachmentButton = [KBButton buttonWithText:@"Add files" image:attachmentImage style:KBButtonStyleToolbar];
  attachmentButton.targetBlock = ^{ [yself chooseInput]; };
  [buttonsView addSubview:attachmentButton];

  //  _files = [YOBox box:@{@"spacing": @(4), @"insets": @(10)}];
//  [contentView addSubview:_files];

  _fileListView = [[KBFileListView alloc] init];
  _fileListView.fileLabelStyle = KBFileLabelStyleLarge;
  _fileListView.menuSelectBlock  = ^(NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Remove" action:@selector(removeFile:) keyEquivalent:@""];
    return menu;
  };
  [contentView addSubview:_fileListView];
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_fileListView topView:toolbarView bottomView:nil insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeZero]];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPEncryptFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  [self addSubview:_footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:contentView topView:topView bottomView:_footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(600, 450)]];

  // Search results from picker view is here so we can float it
  [self addSubview:_userPickerView.searchResultsView];
}

- (void)layout {
  [super layout];
  CGFloat y2 = CGRectGetMaxY(self.userPickerView.frame);
  CGSize size = self.frame.size;
  _userPickerView.searchResultsView.frame = CGRectMake(40, y2, size.width - 40, size.height - y2);
}

- (void)encrypt {
  NSMutableArray *streams = [NSMutableArray array];
  KBFileOutput output = ^(NSString *path) { return [path stringByAppendingPathExtension:@"gpg"]; };
  [KBStream checkFiles:[_fileListView objects] index:0 output:output streams:streams skipCheck:NO view:self completion:^(NSError *error){
    if ([self.navigation setError:error sender:self]) return;
    if ([streams count] > 0) [self encryptStreams:streams];
  }];
}

- (void)encryptStreams:(NSArray *)streams {
  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPgpEncryptOptions *options = [[KBRPgpEncryptOptions alloc] init];
  options.recipients = _userPickerView.usernames;
  options.noSelf = _footerView.includeSelfButton.state != NSOnState;
  options.noSign = _footerView.signButton.state != NSOnState;
  self.navigation.progressEnabled = YES;
  //GHWeakSelf gself = self;
  [_encrypter encryptWithOptions:options streams:streams client:self.client sender:self completion:^(NSError *error, NSArray *streams) {
    self.navigation.progressEnabled = NO;
    if ([self.navigation setError:error sender:self]) return;

    [self showOutput:streams];
  }];
}

- (void)addFile:(KBFile *)file {
  [_fileListView addObjects:@[file]];
}

- (void)removeFile:(id)sender {
  if (!_fileListView.menuIndexPath) return;
  [_fileListView.dataSource removeObjectAtIndexPath:_fileListView.menuIndexPath];
  [_fileListView reloadData];
}

- (void)showOutput:(NSArray *)streams {
  KBPGPOutputFileView *outputView = [[KBPGPOutputFileView alloc] init];
  [outputView setFiles:[streams map:^(KBStream *stream) { return [KBFile fileWithPath:((KBFileWriter *)stream.writer).path]; }]];
  [self.navigation pushView:outputView animated:YES];
}

//- (void)addPath:(NSString *)path {
//  KBFileIcon *icon = [[KBFileIcon alloc] init];
//  icon.iconHeight = 60;
//  [icon setFile:file];
//  [_files addSubview:icon];
//  [_files setNeedsLayout:NO];
//  [self layoutView];
//}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = YES;
  //GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          [self addFile:[KBFile fileWithURL:URL]];
        }
      }
    }
  }];
}

//- (void)chooseOutput {
//  NSSavePanel *panel = [NSSavePanel savePanel];
//  panel.prompt = @"OK";
//  panel.title = @"Destination";
//  panel.allowedFileTypes = @[@"gpg"];
//  panel.allowsOtherFileTypes = YES;
//  panel.canCreateDirectories = YES;
//  panel.canSelectHiddenExtension = YES;
//
//  if ([self.outputSelectView.textField.text gh_isPresent]) {
//    NSString *path = self.outputSelectView.textField.text;
//    panel.nameFieldStringValue = [path lastPathComponent];
//    panel.directoryURL = [NSURL fileURLWithPath:[path stringByDeletingLastPathComponent] isDirectory:YES];
//  }
//
//  GHWeakSelf gself = self;
//  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
//    if (result == NSFileHandlingPanelOKButton) {
//      NSURL *URL = [panel URL];
//      if ([URL isFileURL]) gself.outputSelectView.textField.text = URL.path;
//    }
//  }];
//}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {
  CGSize size = userPickerView.frame.size;
  CGSize sizeThatFits = [userPickerView sizeThatFits:self.frame.size];
  if (sizeThatFits.height > size.height) {
    [self layoutView];
  }
}

@end
