import { createWorker, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

async function getOcrWorker(onProgress?: (message: string) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      onProgress?.('正在加载 OCR 引擎（首次较慢）…')
      const worker = await createWorker(['chi_sim', 'eng'], 1, {
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            onProgress?.(`正在识别图片文字… ${Math.round(message.progress * 100)}%`)
          }
        },
      })
      return worker
    })()
  }
  return workerPromise
}

export async function extractTextFromImage(
  imageDataUrl: string,
  onProgress?: (message: string) => void,
): Promise<string> {
  const worker = await getOcrWorker(onProgress)
  onProgress?.('正在识别图片文字…')
  const result = await worker.recognize(imageDataUrl)
  const text = result.data.text.replace(/\r/g, '').trim()
  if (!text) {
    throw new Error('未能从图片中识别出文字，请换一张更清晰、文字更大的截图')
  }
  return text
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
