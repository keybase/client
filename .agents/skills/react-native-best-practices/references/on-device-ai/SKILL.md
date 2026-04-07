---
name: on-device-ai
description: "Best practices for building on-device AI features in React Native using React Native ExecuTorch. Use when the user wants to add AI to a mobile app without cloud dependencies: AI chatbots and assistants, image classification, object detection, text recognition and document parsing (OCR), style transfer, image generation, speech-to-text transcription, text-to-speech synthesis, voice activity detection, semantic search with embeddings, real-time camera AI with VisionCamera, or vision-language image understanding. Also use when the user mentions offline AI, on-device ML, privacy-preserving AI, reducing cloud API costs or latency, running models locally on mobile, or downloading and managing ML models. Covers react-native-executorch hooks (useLLM, useClassification, useObjectDetection, useOCR, useSemanticSegmentation, useInstanceSegmentation, useStyleTransfer, useTextToImage, useImageEmbeddings, useSpeechToText, useTextToSpeech, useVAD, useTextEmbeddings, useExecutorchModule), tool calling, structured output, VLMs, model loading, and resource management."
---

# On-Device AI

Software Mansion's production patterns for on-device AI in React Native using [React Native ExecuTorch](https://github.com/software-mansion/react-native-executorch).

Load at most one reference file per question. For hook API signatures, model constants, and configuration options, webfetch the relevant page from the official docs at `https://docs.swmansion.com/react-native-executorch/docs/`.

## Decision Tree

Pick the right hook based on the AI task.

```
What AI task does the feature need?
│
├── Text generation, chatbot, or reasoning?
│   └── useLLM                                         → see llm.md
│       ├── Text-only chat → standard useLLM
│       ├── Vision-language (image+text) → useLLM with VLM model
│       ├── Tool calling → configure with toolsConfig
│       └── Structured JSON output → getStructuredOutputPrompt
│
├── Understanding images?
│   ├── What's in this image? → useClassification       → see vision.md
│   ├── Where are objects? → useObjectDetection         → see vision.md
│   ├── Read text from image? → useOCR / useVerticalOCR → see vision.md
│   ├── Segment by class? → useSemanticSegmentation     → see vision.md
│   ├── Segment per-instance? → useInstanceSegmentation → see vision.md
│   ├── Apply artistic style? → useStyleTransfer        → see vision.md
│   ├── Generate image from text? → useTextToImage      → see vision.md
│   └── Embed image as vector? → useImageEmbeddings     → see vision.md
│
├── Speech or audio processing?
│   ├── Transcribe speech → useSpeechToText             → see speech.md
│   ├── Synthesize speech → useTextToSpeech             → see speech.md
│   └── Detect speech segments → useVAD                 → see speech.md
│
├── Text utilities?
│   ├── Convert text to vectors → useTextEmbeddings     → see vision.md
│   └── Count tokens → useTokenizer
│
├── Real-time camera processing?
│   └── runOnFrame with VisionCamera v5                 → see vision.md
│
└── Custom model (.pte)?
    └── useExecutorchModule                             → see setup.md
```

## Critical Rules

- **Call `initExecutorch()` before any other API.** You must initialize the library with a resource fetcher adapter at the entry point of your app. Without it, all hooks throw `ResourceFetcherAdapterNotInitialized`.

- **Always check `isReady` before calling `forward` or `generate`.** Hooks load models asynchronously. Calling inference methods before the model is ready throws `ModuleNotLoaded`.

- **Interrupt LLM generation before unmounting the component.** Unmounting while `isGenerating` is true causes a crash. Call `llm.interrupt()` and wait for `isGenerating` to become false before navigating away.

- **Use quantized models on mobile.** Full-precision models consume too much memory for most devices. React Native ExecuTorch ships quantized variants for all supported models.

- **Audio for speech-to-text must be 16kHz mono.** Mismatched sample rates produce garbled transcriptions silently.

- **Audio from text-to-speech is 24kHz.** Create the `AudioContext` with `{ sampleRate: 24000 }` for playback.

- **Set `pixelFormat: 'rgb'` and `orientationSource="device"` for VisionCamera frame processing.** The default `yuv` format produces incorrect results with ExecuTorch vision models. Missing `orientationSource` causes misaligned bounding boxes and masks.

## References

| File | When to read |
|------|-------------|
| `llm.md` | LLM chat (functional and managed), tool calling, structured output, token batching, context strategy, vision-language models (VLM), model selection, generation config |
| `vision.md` | Image classification, object detection, OCR, semantic segmentation, instance segmentation, style transfer, text-to-image, image/text embeddings, VisionCamera real-time frame processing with `runOnFrame` |
| `speech.md` | Speech-to-text (batch and streaming transcription with timestamps), text-to-speech (batch and streaming synthesis, phoneme input), voice activity detection, audio format requirements |
| `setup.md` | Installation with `initExecutorch`, resource fetcher adapters, model loading strategies (bundled, remote, local), download management, error handling with `RnExecutorchError`, custom models with `useExecutorchModule`, Metro config for `.pte` files |
