/**
 * AES-256-GCM encryption helpers para guardar el certificado y la private
 * key de ARCA en DB. Sin esto, cualquiera con acceso a la DB ve los
 * certificados — y con esos pueden facturar EN NOMBRE del kiosquero.
 *
 * El secret AFIP_ENCRYPTION_KEY debe ser un hex de 64 chars (32 bytes).
 * Generalo con: openssl rand -hex 32
 */

import crypto from "crypto"

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits — recomendado para GCM
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.AFIP_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      "AFIP_ENCRYPTION_KEY debe ser un hex de 64 chars (32 bytes). Generalo con: openssl rand -hex 32"
    )
  }
  return Buffer.from(hex, "hex")
}

/**
 * Encripta un string. Devuelve `<iv-hex>:<tag-hex>:<ciphertext-hex>`.
 * El tag es el authentication tag de GCM — sin él el descifrado es inseguro.
 */
export function encryptAfipCert(plaintext: string): string {
  if (!plaintext) return ""
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/** Descifra. Tira si el tag no valida (DB tampered o key incorrecta). */
export function decryptAfipCert(encoded: string): string {
  if (!encoded) return ""
  const parts = encoded.split(":")
  if (parts.length !== 3) {
    throw new Error("Formato de certificado encriptado inválido")
  }
  const [ivHex, tagHex, ctHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ct = Buffer.from(ctHex, "hex")
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ct), decipher.final()])
  return plain.toString("utf8")
}

/** True si AFIP_ENCRYPTION_KEY está bien configurada en el entorno. */
export function isAfipCryptoConfigured(): boolean {
  const hex = process.env.AFIP_ENCRYPTION_KEY
  return !!hex && hex.length === 64
}
