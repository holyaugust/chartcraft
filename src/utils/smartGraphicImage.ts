const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_IMAGE_EDGE = 1920

export function isSmartGraphicImageFile(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!isSmartGraphicImageFile(file)) {
    throw new Error('请上传 JPG、PNG、WebP 或 GIF 格式的图片')
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('图片过大，请使用 12MB 以内的文件')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('图片读取失败'))
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })

  return compressImageDataUrl(dataUrl)
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.ceil((base64.length * 3) / 4)
}

export async function compressImageDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl)
  let { width, height } = image
  const longest = Math.max(width, height)

  if (longest > MAX_IMAGE_EDGE) {
    const ratio = MAX_IMAGE_EDGE / longest
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.drawImage(image, 0, 0, width, height)

  let quality = 0.92
  let output = canvas.toDataURL('image/jpeg', quality)
  while (estimateDataUrlBytes(output) > MAX_IMAGE_BYTES && quality > 0.45) {
    quality -= 0.08
    output = canvas.toDataURL('image/jpeg', quality)
  }

  return output
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = src
  })
}
