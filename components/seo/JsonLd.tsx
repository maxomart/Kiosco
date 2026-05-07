/**
 * JsonLd — componente Server que renderiza un <script type="application/ld+json">.
 * Va dentro de Server Components (no necesita "use client") para que el
 * crawler lo vea en el HTML inicial sin esperar a JS.
 *
 * Uso:
 *   import { organizationSchema } from "@/lib/seo-schema"
 *   <JsonLd data={organizationSchema()} />
 *
 * Para múltiples schemas en una sola página, podés pasar un array.
 */

interface Props {
  /** Un schema Schema.org o un array de schemas. */
  data: object | object[]
  /** Opcional: id del script para tests / dedup. */
  id?: string
}

export function JsonLd({ data, id }: Props) {
  const json = JSON.stringify(Array.isArray(data) ? data : [data])
  return (
    <script
      type="application/ld+json"
      id={id}
      // dangerouslySetInnerHTML porque Next escapa el contenido de
      // <script> children y rompe el JSON. Es seguro acá porque el
      // input es un objeto controlado (no input de user).
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
