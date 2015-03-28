//
//  KBPGPDecryptFileView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecryptFileView.h"

#import "KBFileListView.h"
#import "KBFile.h"
#import "KBStream.h"
#import "KBPGPDecrypt.h"
#import "KBFileWriter.h"
#import "KBPGPOutputFileView.h"
#import "KBPGPDecryptFooterView.h"

@interface KBPGPDecryptFileView ()
@property KBFileListView *fileListView;
@property KBPGPDecrypt *decrypter;
@end

@implementation KBPGPDecryptFileView

- (void)viewInit {
  [super viewInit];
  [self setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  YOVBox *toolbarView = [YOVBox box];
  [self addSubview:toolbarView];

  YOHBox *buttonsView = [YOHBox box:@{@"insets": @(10)}];
  [toolbarView addSubview:buttonsView];
  [toolbarView addSubview:[KBBox horizontalLine]];

  YOSelf yself = self;
  NSImage *attachmentImage = [NSImage imageNamed:@"1-Edition-black-clip-1-24"];
  attachmentImage.size = CGSizeMake(12, 12);
  KBButton *attachmentButton = [KBButton buttonWithText:@"Open files" image:attachmentImage style:KBButtonStyleToolbar];
  attachmentButton.targetBlock = ^{ [yself chooseInput]; };
  [buttonsView addSubview:attachmentButton];

  _fileListView = [[KBFileListView alloc] init];
  _fileListView.fileLabelStyle = KBFileLabelStyleLarge;
  _fileListView.menuSelectBlock  = ^(NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Show In Finder" action:@selector(showInFinder:) keyEquivalent:@""];
    [menu addItemWithTitle:@"Remove" action:@selector(removeFile:) keyEquivalent:@""];
    return menu;
  };
  [self addSubview:_fileListView];

  KBPGPDecryptFooterView *footerView = [[KBPGPDecryptFooterView alloc] init];
  footerView.decryptButton.targetBlock = ^{ [self decrypt]; };
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_fileListView topView:toolbarView bottomView:footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(600, 450)]];
}

- (void)setFiles:(NSArray *)files {
  [_fileListView addObjects:files];
}

- (void)showInFinder:(id)sender {
  KBFile *file = [_fileListView.dataSource objectAtIndexPath:_fileListView.menuIndexPath];
  [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[[NSURL fileURLWithPath:file.path]]];
}

- (void)removeFile:(id)sender {
  if (!_fileListView.menuIndexPath) return;
  [_fileListView.dataSource removeObjectAtIndexPath:_fileListView.menuIndexPath];
  [_fileListView reloadData];
}

- (void)addFile:(KBFile *)file {
  [_fileListView addObjects:@[file]];
}


- (void)decrypt {
  NSMutableArray *streams = [NSMutableArray array];
  KBFileOutput output = ^(NSString *path) {
    return [path stringByDeletingPathExtension];
  };
  [KBStream checkFiles:[_fileListView objects] index:0 output:output streams:streams skipCheck:NO view:self completion:^(NSError *error){
    if ([self.navigation setError:error sender:self]) return;
    if ([streams count] > 0) [self decryptStreams:streams];
  }];
}

- (void)decryptStreams:(NSArray *)streams {
  _decrypter = [[KBPGPDecrypt alloc] init];
  KBRPgpDecryptOptions *options = [[KBRPgpDecryptOptions alloc] init];

  self.navigation.progressEnabled = YES;
  [_decrypter decryptWithOptions:options streams:streams client:self.client sender:self completion:^(NSError *error, NSArray *streams) {
    self.navigation.progressEnabled = NO;
    if ([self.navigation setError:error sender:self]) return;
    [self showOutput:streams];
  }];
}

- (void)showOutput:(NSArray *)streams {
  KBPGPOutputFileView *outputView = [[KBPGPOutputFileView alloc] init];
  [outputView setFiles:[streams map:^(KBStream *stream) { return [KBFile fileWithPath:((KBFileWriter *)stream.writer).path]; }]];
  [self.navigation pushView:outputView animated:YES];
}

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


@end

