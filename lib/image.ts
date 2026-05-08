/**
 * Redimensiona una imagen subida por el usuario a un cuadrado máximo
 * de `maxSize` px (manteniendo aspect ratio) y la exporta como JPEG
 * data-URL con la calidad indicada (0-1). Pensado para guardar
 * inline en la DB sin pasar por un storage externo.
 *
 * Tamaños de referencia:
 *   - Logo del kiosco: 256, 0.85   → ~30KB
 *   - Foto de producto: 400, 0.75  → ~25-50KB
 */
export async function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("No se pudo leer la imagen"))
      i.src = objectUrl
    })
    let { width, height } = img
    const ratio = width / height
    if (width > height && width > maxSize) {
      width = maxSize
      height = Math.round(maxSize / ratio)
    } else if (height >= width && height > maxSize) {
      height = maxSize
      width = Math.round(maxSize * ratio)
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas no disponible")
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL("image/jpeg", quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
