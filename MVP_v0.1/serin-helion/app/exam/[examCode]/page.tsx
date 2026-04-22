import { notFound } from "next/navigation"

import { CandidateExam } from "@/components/demo/candidate-exam"
import { DEMO_EXAM_CODE, DEMO_EXAM_TITLE } from "@/lib/demo-config"

export default async function ExamPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params

  if (examCode !== DEMO_EXAM_CODE) {
    notFound()
  }

  return <CandidateExam examCode={examCode} examTitle={DEMO_EXAM_TITLE} />
}
