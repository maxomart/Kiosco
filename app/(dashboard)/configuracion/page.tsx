import { auth } from "@/lib/auth"
import { can } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
import ConfiguracionPage from "./ConfiguracionClient"

export default async function ConfiguracionRoute() {
  const session = await auth()
  const role = session?.user?.role

  if (!can(role, "settings:read")) {
    return (
      <NoAccess
        message="Solo el dueño o un administrador pueden ver la configuración del negocio."
      />
    )
  }

  return <ConfiguracionPage />
}
