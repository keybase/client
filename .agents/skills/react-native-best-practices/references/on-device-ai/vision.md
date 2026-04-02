# Computer Vision

Production patterns for on-device computer vision in React Native using React Native ExecuTorch. For hook API signatures and model constants, webfetch the relevant page from the [official docs](https://docs.swmansion.com/react-native-executorch/docs/).

For model loading and resource fetcher setup, see **`setup.md`**.

---

## Hook Overview

All vision hooks share a common interface pattern:

| Hook | Task | Input | Output |
|---|---|---|---|
| [useClassification](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useClassification) | Label an image | Image source | `{ label: probability }` object |
| [useObjectDetection](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useObjectDetection) | Locate objects | Image source | `Detection[]` with bbox, label, score |
| [useOCR](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useOCR) | Read horizontal text | Image source | `OCRDetection[]` with bbox, text, score |
| [useVerticalOCR](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useVerticalOCR) | Read vertical text | Image source | `OCRDetection[]` with bbox, text, score |
| [useSemanticSegmentation](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useSemanticSegmentation) | Pixel-level class labels | Image source | Segmentation mask dictionary |
| [useInstanceSegmentation](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useInstanceSegmentation) | Per-instance masks | Image source | `SegmentedInstance[]` with bbox, label, score, mask |
| [useStyleTransfer](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useStyleTransfer) | Apply art style | Image source | `PixelData` or file URI |
| [useTextToImage](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useTextToImage) | Generate image from text | Text prompt | Base64 PNG |
| [useImageEmbeddings](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useImageEmbeddings) | Image to vector | Image source | `Float32Array` embedding |
| [useTextEmbeddings](https://docs.swmansion.com/react-native-executorch/docs/hooks/natural-language-processing/useTextEmbeddings) | Text to vector | String | `Float32Array` embedding |

### Common interface

Every vision hook returns an object with:

- `isReady` -- model is loaded and ready for inference
- `isGenerating` -- inference is in progress
- `error` -- error object if loading or inference failed
- `downloadProgress` -- 0 to 1 during model download
- `forward(input)` -- run inference on a single image (returns a Promise)

Image inputs accept: remote URLs (`https://...`), local file URIs (`file:///...`), base64-encoded strings, or `PixelData` objects (raw RGB pixel buffers).

---

## Image Classification

Assigns a label to an image. Returns an object mapping class names to probabilities:

```tsx
import { useClassification, EFFICIENTNET_V2_S } from 'react-native-executorch';

const model = useClassification({ model: EFFICIENTNET_V2_S });

const classify = async (imageUri: string) => {
  const scores = await model.forward(imageUri);

  // Get top 3 predictions
  const top3 = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([label, score]) => ({ label, score }));

  return top3;
};
```

If multiple classes have similar probabilities, the model is not confident in its prediction. The hook is generic over the model config, so TypeScript automatically infers the correct label type.

---

## Object Detection

Returns a list of detected objects with bounding boxes, labels, and confidence scores:

```tsx
import { useObjectDetection, SSDLITE_320_MOBILENET_V3_LARGE } from 'react-native-executorch';

const model = useObjectDetection({ model: SSDLITE_320_MOBILENET_V3_LARGE });

const detect = async (imageUri: string) => {
  const detections = await model.forward(imageUri);

  for (const det of detections) {
    console.log(det.label, det.score, det.bbox); // bbox: { x1, y1, x2, y2 }
  }
};
```

Bounding box coordinates are top-left (`x1`, `y1`) and bottom-right (`x2`, `y2`) in the original image's pixel space.

### Detection options

`forward` accepts an optional second argument with detection parameters:

```tsx
const detections = await model.forward(imageUri, {
  detectionThreshold: 0.5,   // minimum confidence score (default: ~0.7)
  iouThreshold: 0.55,        // IoU threshold for non-maximum suppression
  inputSize: 640,             // for YOLO multi-size models: 384, 512, or 640
  classesOfInterest: ['CAR', 'PERSON'], // filter to specific classes
});
```

### Multi-size models (YOLO)

YOLO models support multiple input resolutions. Use `getAvailableInputSizes()` to query them:

```tsx
const model = useObjectDetection({ model: YOLO26N });
const sizes = model.getAvailableInputSizes(); // [384, 512, 640]
```

Smaller sizes are faster but less accurate. Larger sizes are more accurate but slower.

### Supported models

| Model | Classes | Multi-size |
|---|---|---|
| SSDLite320 MobileNetV3 Large | 91 (COCO) | No |
| RF-DETR Nano | 80 (COCO) | No |
| YOLO26N/S/M/L/X | 80 (COCO) | Yes (384/512/640) |

---

## OCR (Optical Character Recognition)

`useOCR` reads horizontal text. `useVerticalOCR` reads vertical text (e.g., Japanese, Chinese). Both return `OCRDetection[]` with bounding boxes, text, and confidence scores.

For hook APIs, webfetch [useOCR](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useOCR) and [useVerticalOCR](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useVerticalOCR).

```tsx
import { useOCR, OCR_ENGLISH } from 'react-native-executorch';

const model = useOCR({ model: OCR_ENGLISH });

const readText = async (imageUri: string) => {
  const results = await model.forward(imageUri);
  for (const det of results) {
    console.log(det.text, det.score, det.bbox); // bbox: Point[] (4 corners)
  }
};
```

### Language support

Each supported alphabet requires its own recognizer model. The simplified language constants (e.g., `OCR_ENGLISH`, `OCR_RUSSIAN`, `OCR_JAPANESE`) bundle the correct detector and recognizer automatically. For the full list of 84 supported languages, webfetch [OCR Supported Alphabets](https://docs.swmansion.com/react-native-executorch/docs/api-reference#ocr-supported-alphabets).

When using custom recognizers, ensure the recognizer alphabet matches the language:
- `RECOGNIZER_LATIN_CRNN` for Latin-alphabet languages (Polish, German, etc.)
- `RECOGNIZER_CYRILLIC_CRNN` for Cyrillic-alphabet languages (Russian, Ukrainian, etc.)

The detector model is CRAFT (text detection); recognizers are CRNN (text recognition).

---

## Semantic Segmentation

Assigns a class label to every pixel in an image. Useful for background removal, scene understanding, and portrait effects. For the full API, webfetch [useSemanticSegmentation](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useSemanticSegmentation).

```tsx
import { useSemanticSegmentation, DEEPLAB_V3_RESNET50 } from 'react-native-executorch';

const model = useSemanticSegmentation({ model: DEEPLAB_V3_RESNET50 });

const segment = async (imageUri: string) => {
  // forward(imageUri, classesOfInterest?, resizeToInput?)
  const result = await model.forward(imageUri, ['CAT'], true);

  // result.ARGMAX: per-pixel class index (Int32Array, always present)
  // result.CAT: per-pixel probability for CAT class (Float32Array)
};
```

- `classesOfInterest` (optional): string array of label names specifying which classes to return full probability masks for. Default is `[]` (only ARGMAX returned).
- `resizeToInput` (optional): if `true` (default), output is rescaled to original image dimensions. If `false`, returns the raw model output dimensions (e.g. 224x224). Setting to `false` makes `forward` faster.

### Supported models

| Model | Classes |
|---|---|
| deeplab-v3-resnet50 | 21 (DeeplabLabel) |
| deeplab-v3-resnet101 | 21 (DeeplabLabel) |
| deeplab-v3-mobilenet-v3-large | 21 (DeeplabLabel) |
| lraspp-mobilenet-v3-large | 21 (DeeplabLabel) |
| fcn-resnet50 | 21 (DeeplabLabel) |
| fcn-resnet101 | 21 (DeeplabLabel) |
| selfie-segmentation | 2 (SelfieSegmentationLabel) |

---

## Instance Segmentation

Detects individual objects and produces a per-pixel segmentation mask for each one. Provides precise object boundaries beyond bounding boxes. For the full API, webfetch [useInstanceSegmentation](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useInstanceSegmentation).

```tsx
import { useInstanceSegmentation, YOLO26N_SEG } from 'react-native-executorch';

const model = useInstanceSegmentation({ model: YOLO26N_SEG });

const segment = async (imageUri: string) => {
  const instances = await model.forward(imageUri, {
    confidenceThreshold: 0.5,
    inputSize: 640,
  });

  for (const inst of instances) {
    console.log(inst.label, inst.score, inst.bbox);
    console.log('Mask:', inst.maskWidth, 'x', inst.maskHeight);
    // inst.mask: Uint8Array binary mask (0 or 1)
  }
};
```

### Options

- `confidenceThreshold`: minimum confidence score (default: ~0.5)
- `iouThreshold`: IoU threshold for NMS (default: 0.5)
- `maxInstances`: maximum returned instances (default: 100)
- `classesOfInterest`: filter to specific classes (e.g., `['PERSON', 'CAR']`)
- `returnMaskAtOriginalResolution`: resize masks to original image dimensions (default: `true`)
- `inputSize`: for multi-size models (384, 512, or 640)

### Supported models

| Model | Classes | Input sizes |
|---|---|---|
| yolo26n-seg / yolo26s-seg / yolo26m-seg / yolo26l-seg / yolo26x-seg | 80 (COCO) | 384, 512, 640 |
| rfdetr-nano-seg | 91 (COCO) | N/A |

---

## Style Transfer

Applies an artistic style to an image. For the full API, webfetch [useStyleTransfer](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useStyleTransfer).

```tsx
import { useStyleTransfer, STYLE_TRANSFER_CANDY } from 'react-native-executorch';

const model = useStyleTransfer({ model: STYLE_TRANSFER_CANDY });

// Returns raw PixelData (default) -- useful for further processing
const pixels = await model.forward(imageUri);
// pixels.dataPtr is a Uint8Array of RGB bytes

// Returns a file URI -- easy to pass to <Image source={{ uri }} />
const uri = await model.forward(imageUri, 'url');
```

Available models: `STYLE_TRANSFER_CANDY`, `STYLE_TRANSFER_MOSAIC`, `STYLE_TRANSFER_UDNIE`, `STYLE_TRANSFER_RAIN_PRINCESS`.

---

## Text-to-Image

Generates an image from a text prompt using a compressed Stable Diffusion model. For the full API, webfetch [useTextToImage](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/useTextToImage).

```tsx
import { useTextToImage, BK_SDM_TINY_VPRED_512 } from 'react-native-executorch';

const model = useTextToImage({
  ...BK_SDM_TINY_VPRED_512,
  inferenceCallback: (progress) => console.log(`Step: ${progress}`),
});

const generate = async () => {
  // generate(prompt, imageSize, numSteps, seed?)
  const base64Png = await model.generate('a cat sitting on a couch', 512, 25);
};
```

- `imageSize` must be a multiple of 32 (256 or 512 supported)
- `numSteps`: number of denoising iterations
- `seed` (optional): for reproducible results

Available models: `BK_SDM_TINY_VPRED_256`, `BK_SDM_TINY_VPRED_512`.

---

## Embeddings

Convert images or text into vector representations for similarity search, retrieval-augmented generation (RAG), or clustering.

```tsx
import { useImageEmbeddings, CLIP_VIT_BASE_PATCH32_IMAGE } from 'react-native-executorch';

const model = useImageEmbeddings({ model: CLIP_VIT_BASE_PATCH32_IMAGE });

const embedding = await model.forward(imageUri);
// embedding is a Float32Array (512 dimensions, normalized)
```

Text embeddings follow the same pattern with `useTextEmbeddings`. Available text embedding models:

| Model | Dimensions | Max tokens | Best for |
|---|---|---|---|
| `ALL_MINILM_L6_V2` | 384 | 254 | General purpose |
| `ALL_MPNET_BASE_V2` | 768 | 382 | General purpose (higher quality) |
| `MULTI_QA_MINILM_L6_COS_V1` | 384 | 509 | Search / QA |
| `MULTI_QA_MPNET_BASE_DOT_V1` | 768 | 510 | Search / QA (higher quality) |
| `CLIP_VIT_BASE_PATCH32_TEXT` | 512 | 74 | Cross-modal search with CLIP images |

Combine image and text embeddings from the same model family (CLIP) for cross-modal search. Embeddings are normalized, so cosine similarity equals dot product.

Use `useTokenizer` to count tokens before processing variable-length input. Text exceeding the model's token limit is truncated silently.

---

## VisionCamera Real-Time Frame Processing

Vision hooks that support `runOnFrame` can process camera frames in real time using VisionCamera v5.

### Supported hooks

`useClassification`, `useObjectDetection`, `useOCR`, `useVerticalOCR`, `useImageEmbeddings`, `useSemanticSegmentation`, `useInstanceSegmentation`, `useStyleTransfer`.

### runOnFrame vs forward

| | `runOnFrame` | `forward` |
|---|---|---|
| Thread | JS worklet thread (synchronous) | Background thread (async) |
| Input | VisionCamera `Frame` | Image source (URI, base64, PixelData) |
| Use case | Real-time camera | Single image |

### Setup

Requires `react-native-vision-camera` v5 and `react-native-worklets`.

```tsx
import { useState, useCallback } from 'react';
import { Text, StyleSheet } from 'react-native';
import {
  Camera,
  Frame,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { useClassification, EFFICIENTNET_V2_S } from 'react-native-executorch';

function LiveClassifier() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'back');
  const model = useClassification({ model: EFFICIENTNET_V2_S });
  const [topLabel, setTopLabel] = useState('');

  const runOnFrame = model.runOnFrame;

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',           // Required: must be 'rgb'
    dropFramesWhileBusy: true,    // Skip frames during slow inference
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';
        if (!runOnFrame) return;
        try {
          const isFrontCamera = false;
          const scores = runOnFrame(frame, isFrontCamera);
          if (scores) {
            let best = '';
            let bestScore = -1;
            for (const [label, score] of Object.entries(scores)) {
              if ((score as number) > bestScore) {
                bestScore = score as number;
                best = label;
              }
            }
            scheduleOnRN(setTopLabel, best);
          }
        } finally {
          frame.dispose(); // Always dispose to avoid memory leaks
        }
      },
      [runOnFrame]
    ),
  });

  if (!hasPermission) {
    requestPermission();
    return null;
  }
  if (!device) return null;

  return (
    <>
      <Camera
        style={styles.camera}
        device={device}
        outputs={[frameOutput]}
        isActive
        orientationSource="device"
      />
      <Text style={styles.label}>{topLabel}</Text>
    </>
  );
}
```

### Camera configuration

- **`orientationSource="device"`** is required for correct orientation handling. Without it, bounding boxes and masks will be misaligned.
- **Do not set `enablePhysicalBufferRotation`** -- this conflicts with the library's orientation handling.

### Handling front/back camera

The `isFrontCamera` parameter tells the native side to correctly mirror results. Since worklets cannot read React state directly, use a `Synchronizable` from `react-native-worklets`:

```tsx
import { createSynchronizable } from 'react-native-worklets';

const cameraPositionSync = createSynchronizable<'front' | 'back'>('back');

// In component:
useEffect(() => {
  cameraPositionSync.setBlocking(cameraPosition);
}, [cameraPosition]);

// In worklet:
const isFrontCamera = cameraPositionSync.getDirty() === 'front';
const result = runOnFrame(frame, isFrontCamera);
```

### Gotchas

- **`pixelFormat: 'rgb'` is mandatory.** The default VisionCamera format is `yuv`, which produces scrambled results.
- **Always call `frame.dispose()` in a `finally` block.** Skipping this leaks memory and crashes after processing many frames.
- **Guard `runOnFrame` for null.** It is `null` until the model finishes loading. Check `if (!runOnFrame) return` inside `onFrame`.
- **Use `dropFramesWhileBusy: true`** for models with longer inference times. Without it, the camera pipeline blocks.
- **`runOnFrame` is synchronous and runs on the JS worklet thread.** For models that take longer than a frame interval, consider VisionCamera's [async frame processing](https://react-native-vision-camera-v5-docs.vercel.app/docs/async-frame-processing).

### Module API with VisionCamera

When using the TypeScript Module API (e.g., `ClassificationModule`) instead of hooks, instantiate via `fromModelName` and wrap `runOnFrame` in a functional updater to prevent React from calling it as a state initializer:

```tsx
const [runOnFrame, setRunOnFrame] = useState<typeof module.runOnFrame | null>(null);

useEffect(() => {
  ClassificationModule.fromModelName(EFFICIENTNET_V2_S).then((module) => {
    // () => module.runOnFrame prevents React from calling it as initializer
    setRunOnFrame(() => module.runOnFrame);
  });
}, []);
```
