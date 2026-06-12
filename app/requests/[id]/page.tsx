import { RequestDetail } from "@/components/branded-content/request-detail"

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <RequestDetail requestId={id} />
}
