/**
 * Firma CMS / PKCS#7 SignedData para WSAA de AFIP.
 *
 * AFIP requiere que el Login Ticket Request (TRA, un XML) se firme con la
 * clave privada del contribuyente y se envíe como un mensaje CMS SignedData
 * en formato DER, codificado base64. Es lo que va en el campo <in0> del
 * `loginCms` del WSAA.
 *
 * Algoritmo de digest:
 *   AFIP acepta tanto SHA-1 como SHA-256. Usamos SHA-256 por seguridad —
 *   si en algún momento rechazara, cambiar `digestAlgorithm` a sha1.
 */

import forge from "node-forge"

export interface SignCMSOptions {
  /** XML del TRA (Login Ticket Request) a firmar. */
  xml: string
  /** Certificado X.509 PEM del contribuyente. */
  certPem: string
  /** Private key PEM del contribuyente. */
  keyPem: string
}

/** Firma el XML en CMS SignedData y devuelve el DER en base64. */
export function signCMS({ xml, certPem, keyPem }: SignCMSOptions): string {
  const cert = forge.pki.certificateFromPem(certPem)
  const key = forge.pki.privateKeyFromPem(keyPem)

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(xml, "utf8")
  p7.addCertificate(cert)
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  })
  p7.sign({ detached: false })

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return forge.util.encode64(der)
}

/**
 * Devuelve la fecha "notAfter" del certificado X.509. Sirve para chequear
 * expiración antes de pegarle al WSAA (ahorra un round-trip + error feo).
 */
export function certNotAfter(certPem: string): Date {
  const cert = forge.pki.certificateFromPem(certPem)
  return cert.validity.notAfter
}

/** True si el cert vence en menos de N días desde ahora (default 30). */
export function certExpiresSoon(certPem: string, days = 30): boolean {
  const notAfter = certNotAfter(certPem).getTime()
  const threshold = Date.now() + days * 24 * 60 * 60 * 1000
  return notAfter < threshold
}
