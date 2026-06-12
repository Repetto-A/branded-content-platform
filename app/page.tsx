import { BrandedStudio } from "@/components/branded-content/studio"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Branded Content Studio",
  description:
    "Create branded images, carousels, and avatar videos with a provider-switchable custom studio powered by durable workflows.",
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <BrandedStudio />
    </main>
  )
}
