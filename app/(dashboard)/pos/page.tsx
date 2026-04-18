import { Metadata } from "next"
import POSScreen from "@/components/pos/POSScreen"

export const metadata: Metadata = {
  title: "Caja | KioscoApp",
}

export default function POSPage() {
  return <POSScreen />
}
